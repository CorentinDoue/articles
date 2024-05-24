---
published: true
title: 'Top 10 common errors I wish I hadn’t made using SQS'
cover_image: 'https://raw.githubusercontent.com/CorentinDoue/articles/master/blog-posts/swarmion-sqs-contract/assets/cov.png'
description: 'Common errors using SQS and how to solves them'
tags: aws, webdev, sqs, serverless
series:
canonical_url:
---

Amazon SQS is a powerful service for messaging in traditional or Serverless applications, but it comes with its own set of challenges. I've compiled a list of common mistakes and best practices to help you navigate SQS more effectively. I also released the [Swarmion SQS contract](https://www.swarmion.dev/docs/how-to-guides/use-serverless-contracts/sqs) that helps you avoid these pitfalls and focus on your business logic.

## TL;DR;

Configuration

- ❌ Don’t expect SQS messages to be consumed in the order they are sent
- ❌ Don’t set a too small _Retention Period_
- ❌ Don’t set a too small _Visibility Timeout_
- ❌ Don’t use Lambda reserved concurrency to control throughput

Producer

- ❌ Don’t send messages that the consumer can’t process
- ❌ Don’t send messages individually
- ❌ Don’t send too many messages to `SendMessageBatchCommand` or batch too big messages
- ❌ Don’t forget to handle `SendMessageBatchCommand` results
- ❌ Don’t send too many messages to SQS FIFO queues
- ❌ Don’t forget to use `MessageGroupeId` for SQS FIFO Queues
- ❌ Don’t use `uuid()` as `MessageDeduplicationId`

Consumer

- ❌ Don’t throw errors while processing a batch of SQS messages

> 🤔 Yeah, there are 12. But a top 10 title sounded better

---

## SQS Configuration

### 🙅 Error: Expecting messages to be consumed in the order they are sent

💥 Impact: 🐛 Stability. Messages are processed in an unpredictable order.

✅ Solution: Use SQS FIFO if you need to process messages in a precise order

---

### 🙅 Error: Setting a too small _Retention Period_

💥 Impact: 🐛 Stability. Messages can be deleted before they are processed, especially with delays or multiple retries. This can be a debugging nightmare.

✅ Solution: Set a generous retention period if you plan to use delays or retries. Retention is not billed.

---

### 🙅 Error: Setting a too small _Visibility Timeout_

💥 Impact: 🐛 Stability. Messages can be processed several times if their visibility timeout expires before their first processor delete them.

✅ Solution: AWS recommends setting a visibility timeout three time longer than the expected message processing duration.

---

### 🙅 Error: Using Lambda reserved concurrency to control throughput

💥 Impact: 🐛 Stability. [Messages can be lost due to throttle errors returned by the Lambda service](https://www.youtube.com/watch?v=MCDEBA7asww), which can result in them being sent to the DLQ without being processed.

✅ Solution: Use the `MaxConcurency` parameter of the event source mapping instead of Lambda reserved concurrency.

---

## Producer

### 🙅 Error: Sending messages that the consumer can’t process

💥 Impact: 🐛 Stability. Consumers will throw errors, causing messages to be lost or behave unpredictably.

✅ Solution: Enforce a strong interface between your producers and consumers.

💡You can use [Swarmion contracts](https://www.swarmion.dev/docs/why-swarmion/serverless-contracts/concepts) to create and enforce interfaces between your lambdas and the services that use them.

---

### 🙅 Error: Sending messages individually

💥 Impact: ⚡💰 Performance and cost. Each message is sent as an HTTP request, increasing both time and cost.

✅ Solution: Use `SendMessageBatchCommand` to batch messages up to 10. One batch request is billed as one request.

💡You can use the [`sendMessages` utility of Swarmion SQS contract](https://www.swarmion.dev/docs/how-to-guides/use-serverless-contracts/sqs#build-a-typed-sendmessages-function) to send multiple messages without bothering with technical aspects

---

### 🙅 Error: Sending too many messages to `SendMessageBatchCommand` or batch too large messages

💥 Impact: 🐛 Stability. `SendMessageBatchCommand` can batch up to 10 messages with a total size below 256Kb. Exceeding these limits will cause the batch to be rejected, potentially losing messages.

✅ Solution: Batch messages up to 10, ensuring the total size is within limits.

💡 The [`sendMessages` utility of Swarmion SQS contract](https://www.swarmion.dev/docs/how-to-guides/use-serverless-contracts/sqs#build-a-typed-sendmessages-function) provides automatic batching that follow these rules. Just pass an array of messages and it handles the rest.

---

### 🙅 Error: Forgetting to handle `SendMessageBatchCommand` results

💥 Impact: 🐛 Stability. `SendMessageBatchCommand` doesn’t throw if messages are throttled, they are returned in the response.

✅ Solution: Handle failed batch items returned by `SendMessageBatchCommand` and retry them.

💡The [`sendMessages` utility of Swarmion SQS contract](https://www.swarmion.dev/docs/how-to-guides/use-serverless-contracts/sqs#build-a-typed-sendmessages-function) automatically retries throttled messages and throws errors by default to avoid silent bugs.

---

### 🙅 Error: Sending too many messages to SQS FIFO queues

💥 Impact: 🐛 Stability. [FIFO queues are throttled at 300 requests per second](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html), causing some messages to be lost if not handled.

✅ Solution: Use high throughput FIFO queues or/and control the throughput rate of your sender.

💡The [`sendMessages` utility of Swarmion SQS contract](https://www.swarmion.dev/docs/how-to-guides/use-serverless-contracts/sqs#build-a-typed-sendmessages-function) provides a `throughputCallsPerSecond` parameter to precisely control throughput.

---

### 🙅 Error: Forgetting to use `MessageGroupeId` for SQS FIFO Queues

💥 Impact: ⚡Performance. All messages will be processed one at the time.

✅ Solution: use `MessageGroupeId` to enable parallel processing of message groups. Group messages by related usage to allow unrelated messages to be processed in parallel.

---

### 🙅 Error: Using `uuid()` as `MessageDeduplicationId`

💥 Impact: 🐛 Stability. Messages can be processed multiple times.

✅ Solution: `MessageDeduplicationId` must be a hash of your message content

---

## Consumer

### 🙅 Error: Throwing errors while processing a batch of SQS messages

💥 Impact: ⚡🐛 Performance and stability. The entire batch will be retried after the visibility timeout is reached. Some messages will be processed or partially processed multiple times. As no message is deleted, this jam the queue.

✅ Solution: Catch errors individually and delete successfully processed messages. With lambda event source mapping, use [`ReportBatchItemFailures` function response type](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting) and send back the unprocessed `messageIds`.

💡You can use the [`getHandler` utility of Swarmion SQS contract](https://www.swarmion.dev/docs/how-to-guides/use-serverless-contracts/sqs#generate-the-lambda-handler) to generate a wrapper around your handler to process messages individually, catch errors and report failed messages to SQS.

---

## **Conclusion**

I hope these insights help you avoid the common mistakes I’ve encountered while working with SQS. Please share your experiences and any other tips you have for using SQS effectively.
