---
published: true
title: 'Blazing fast CI for serverless integration tests'
cover_image:
description:
tags: aws, serverless, testing, node
series:
canonical_url:
---

Running integration tests in a CI can be quite challenging. It's even more challenging with serverless applications because they interact with lots of services.

In previous articles I explained how to test your serverless app in integration with real AWS services.

{% embed https://dev.to/kumo/how-to-write-integration-tests-on-your-aws-nodejs-serverless-application-4hgd %}

{% embed https://dev.to/kumo/5-control-points-to-implement-serverless-integration-tests-like-a-boss-82b %}

This article describes one way to implement the logical next step: running those integration tests in your CI for each feature branch of your team as fast as possible.

## TL;DR

Set up a test account with multiple production-like copies of your application. This pool of stacks will be available for the CI to speed up the setup of the integration tests. Dimension it according to your team size and CI frequency.

For each CI job:

1. Get an existing production-like stack and dedicate it to the job.
2. Update the stack. It's far quicker than creating it.
3. Get the environment variables of the resources of the stack.
4. Run the tests in integration with the ressources of the stack.
5. Release the stack for the next job on success or failure.

```bash
# 1. Request an available stack and lock it
requestStackResult=$(curl --location --request POST 'https://stack-orchestrator.theodo.org/requestStack' \
   --header "X-API-Key: $ORCHESTRATOR_KEY" \
   --header "Content-Type: application/json" \
   --data-raw "{
     \"branch\": \"$GIT_BRANCH\"
   }")
stackName=$(echo "$requestStackResult" | jq -r .stackName)

echo "$stackName will be used"

# 2. Deploy the stack
yarn sls deploy --stage "$stackName"

# 3. Get the environment variables
cfnOutputs=$(aws cloudformation list-exports)
get_cfn_output_value() {
  echo "$cfnOutputs" |
    jq -r --arg cfnOutputName "$1" \
      '.Exports[] | select(.Name==$cfnOutputName) | .Value'
}

echo "TABLE_NAME=$(get_cfn_output_value "table-name-$stackName")" >> .env
echo "BUS_NAME=$(get_cfn_output_value "bus-name-$stackName")" >> .env

# 4. Execute the tests
yarn test:integration

# 5. Release the stack
curl --location --request POST 'https://stack-orchestrator.theodo.org/releaseStack' \
  --header "X-API-Key: $ORCHESTRATOR_KEY" \
  --header "Content-Type: application/json" \
  --data-raw "{ \"stackName\": \"$stackName\" }"

```

## The plan

You can run locally the tests you created following the previous article. The test interact with real AWS services of your dev account.

![macro local schema](./assets/macro-local-schema.png 'Macro local schema')

![micro local schema](./assets/micro-local-schema.png 'Micro local schema')

You now want to execute the tests in your CI to protect your main branch. Your team works on multiple branches at the same times. You will have to orchestrate multiple test stacks and then execute the tests against the right stack.

## 1. Orchestrate multiple stacks

A CI job can be triggered on different branches that have different services and tests. Moreover, the CI could have multiple jobs concurrently. Therefore, each job must have a dedicated stack to use for its tests. The obtention and update of these stacks must be as efficient as possible.

![macro ci schema](./assets/macro-ci-schema.png 'Macro ci schema')

Having multiple stacks is not a problem. Most serverless frameworks can identify which stack to deploy with a prefix that is added on most resources.

For example with Serverless framework you can use

```bash
$ yarn serverless deploy --stage test-1
$ yarn serverless deploy --stage test-2
```

to deploy your application twice.

If you only use serverless services with on-demand pricing, having one, two, or ten stacks will not increase your bill.

But deploying a whole new stack is slow. It shouldn't be done for each CI job. Instead, you could reuse a stack from one job to another. The deployment will be a lot faster because it will only deploy the difference between the last time the stack has been used and the state of the feature branch.

A job must be able to know what stack it should use. A job mustn't be able to choose the same stack which is used by another job to avoid conflicts.

I developed a small API to handle the orchestration of those stacks.

{% embed https://github.com/theodo/test-stack-orchestrator %}

It enables to:

1. Request an available stack and lock it.
2. Release the stack when the job is done.

```bash
# 1. Request an available stack and lock it
requestStackResult=$(curl --location --request POST 'https://stack-orchestrator.theodo.org/requestStack' \
  --header "X-API-Key: $ORCHESTRATOR_KEY" \
  --header "Content-Type: application/json" \
  --data-raw "{
    \"branch\": \"$GIT_BRANCH\"
  }")
stackName=$(echo "$requestStackResult" | jq -r .stackName)

echo "$stackName will be used"

# 2. Deploy the stack
yarn sls deploy --stage "$stackName"

# 3. Execute the tests
# ...

# 4. Release the stack
curl --location --request POST 'https://stack-orchestrator.theodo.org/releaseStack' \
  --header "X-API-Key: $ORCHESTRATOR_KEY" \
  --header "Content-Type: application/json" \
  --data-raw "{ \"stackName\": \"$stackName\" }"

```

_Note: The stack orchestrator API also enables you to store the last commit deployed of each stack. Then you can deploy only the code affected since the last deployment._

## 2. Run your tests in interaction with the right ressources

Multiple stacks mean multiple services. Each CI job must configure its tests to run in interaction with its corresponding stack.

![micro ci schema](./assets/micro-ci-schema.png 'Micro ci schema')

The tests use environment variables to identify the resources to use. Those variables are loaded from a `.env` file.

Let's assume being in CI job which has requested and deployed the stack `test-1`. You need to build a `.env` with the `TABLE_NAME` and `BUS_NAME` of the DynamoDB table and EventBridge bus of the stack `test-1`.

Lets use [CloudFormation Outputs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html) to easily gets those values.

```json
"Outputs" : {
  "DynamoDbTableName" : {
    "Value" : { "Ref": "DynamoDbTable" },
    "Export" : { "Name": "table-name-test-1" }
  },
  "EventBusName" : {
    "Value" : { "Ref": "EventBus" },
    "Export" : { "Name": "bus-name-test-1" }
  }
}
```

The name of the exports must contain the stack name. If you use the Serverless framework, use the stage variable: `"table-name-${sls:stage}"`.

After the deployment of a stack, you can now get the names of the DynamoDB table and the EventBridge bus of this stack using [the list exports command of the AWS CLI](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/list-exports.html).

```bash
cfnOutputs=$(aws cloudformation list-exports)
get_cfn_output_value() {
  echo "$cfnOutputs" |
    jq -r --arg cfnOutputName "$1" \
      '.Exports[] | select(.Name==$cfnOutputName) | .Value'
}

echo "TABLE_NAME=$(get_cfn_output_value "table-name-$stackName")" >> .env
echo "BUS_NAME=$(get_cfn_output_value "bus-name-$stackName")" >> .env
```

The execution of the test will be similar to locally. No further argument is required.

```bash
yarn test:integration
```

## A complete bash script

```bash
# 1. Setup common environment variables
cp .env.ci.test .env.test

# 2. Get an available test stack
requestStackResult=$(curl --location --request POST 'https://stack-orchestrator.theodo.org/requestStack' \
  --header "X-API-Key: $ORCHESTRATOR_KEY" \
  --header "Content-Type: application/json" \
  --data-raw "{
    \"branch\": \"$GIT_BRANCH\"
  }")
stackName=$(echo "$requestStackResult" | jq -r .stackName)
lastDeployedCommit=$(echo "$requestStackResult" | jq -r .lastDeployedCommit)

echo "$stackName will be used"
echo "STAGE=$stackName" >>.env.test

release_stack() {
  curl --location --request POST 'https://stack-orchestrator.theodo.org/releaseStack' \
    --header "X-API-Key: $ORCHESTRATOR_KEY" \
    --header "Content-Type: application/json" \
    --data-raw "{
        \"stackName\": \"$stackName\"
    }"
}

# 3. Deploy stack
yarn sls deploy --stage "$stackName"
# Release stack and exit script if deploy failed
if [ $? -ne 0 ]; then
  echo "Deploy failed"
  release_stack
  exit 1
fi
# Set last deployed commit
curl --location --request POST 'https://stack-orchestrator.theodo.org/setLastDeployedCommit' \
  --header "X-API-Key: $ORCHESTRATOR_KEY" \
  --header "Content-Type: application/json" \
  --data-raw "{
      \"stackName\": \"$stackName\",
      \"lastDeployedCommit\": \"$(git rev-parse HEAD)\"
  }"


# 4. get environment variables of the stack
cfnOutputs=$(aws cloudformation list-exports --profile test-profile)
get_cfn_output_value() {
  echo "$cfnOutputs" |
    jq -r --arg cfnOutputName "$1" \
      '.Exports[] | select(.Name==$cfnOutputName) | .Value'
}

echo "TABLE_NAME=$(get_cfn_output_value "table-name-$stackName")" >>.env.test
echo "BUS_NAME=$(get_cfn_output_value "bus-name-$stackName")" >>.env.test

# 5. Run migrations only if there is new ones
if git diff --name-only "$lastDeployedCommit" HEAD | grep migrations; then
   yarn migrate --stage "$stackName"

   # Release stack and exit script if migration failed
   if [ $? -ne 0 ]; then
     echo "Migrate failed"
     release_stack
     exit 1
   fi
fi

# 6. Run integration tests
yarn test:integration

# Release stack and exit script if tests failed
if [ $? -ne 0 ]; then
  echo "Test failed"
  release_stack
  exit 1
fi

# 7. Release the stack
release_stack
```

## Conclusion

You now know how to test your serverless application in integration with real AWS services before each merge on your main branch. Those tests are quite powerful. I use integration tests running in my CI for 6 months and it prevented at least a dozen of regressions and bugs.

As your code grows the integration test job can become slower. Depending on your architecture, lots of micro enhancements can be added to improve the speed of the job such as parallelism or deploy only affected code.

Feedbacks are welcome 😃
