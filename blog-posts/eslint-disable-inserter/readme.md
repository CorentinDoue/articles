---
published: true
title: 'Enforcing ESLint rules: A guide to taming codebase chaos'
cover_image: 'https://raw.githubusercontent.com/CorentinDoue/articles/master/blog-posts/eslint-disable-inserter/assets/cov.png'
description: 'How to manage ESLint errors when introducing new rules'
tags: nodejs, eslint, javascript, webdev
series:
canonical_url:
---

In the dynamic world of javascript development, ESLint plays a vital role in maintaining code quality. When developers install ESLint or introduce new rules, it often reveals tons of errors. How to manage them?

## 📝 TL;DR

1. Use errors to make the rules blocking and enforce it in your CI.
2. Comment out all existing ESLint errors using a script like [`eslint-disable-inserter`](https://www.npmjs.com/package/eslint-disable-inserter).
3. Merge this as soon as possible to prevent new errors from being added.
4. Then fix the errors at your own pace.

## ⚠️ The temptation of the Warnings️

When developers first face ESLint errors, the volume of violations across files can be daunting. Some may be tempted to convert these errors into warnings to quickly pass the linter without addressing the underlying issues.

This is a bad practice, nothing will prevent new errors from being added. The developers will not know what is an acceptable warning or an error disguised as a warning.

## ⚔️ Another Pitfall: Try to fix them all at once

Some developers can be tempted to fix all existing errors before applying new ESLint rules to the codebase. While this approach seems logical, it often results in massive pull requests that are challenging to review and rebase. As developers work to resolve errors, others may simultaneously introduce new ones, making it an endless battle.

## 🤖 A Better Approach: `eslint-disable-inserter`

To address this issue and ease new rule usage, I created `eslint-disable-inserter`, a npm package that simplifies commenting existing ESLint errors.

{% embed https://github.com/CorentinDoue/eslint-disable-inserter %}

### How `eslint-disable-inserter` Works

`eslint-disable-inserter` automatically inserts `// eslint-disable-next-line ...` or `{/* eslint-disable-next-line ... */}` comments into your code, silencing existing ESLint errors. It handles JSX detection and is idempotent, allowing repeated use without duplicates.

### Example: Transforming Code

Suppose you have the following TypeScript file with ESLint violations:

```tsx
export const MyComponent = () => {
  let count = 0;
  count += 1;
  const messages: any = undefined;
  return (
    <div>
      <h1>MyComponent</h1>
      <p>Count: {count + messages.myMessage}</p>
      {/* eslint-disable-next-line eqeqeq -- my comment */}
      <p>Is Zero: {count == 0 ? messages.yes : messages.no}</p>
    </div>
  );
};
```

Running the following command:

```bash
eslint --format json . | eslint-disable-inserter
```

Will transform the file to:

```tsx
export const MyComponent = () => {
  let count = 0;
  count += 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FIXME
  const messages: any = undefined;
  return (
    <div>
      <h1>MyComponent</h1>
      {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- FIXME */}
      <p>Count: {count + messages.myMessage}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, eqeqeq -- FIXME my comment */}
      <p>Is Zero: {count == 0 ? messages.yes : messages.no}</p>
    </div>
  );
};
```

## ♻️ Fix them all at your own pace

You have explicit comments for all existing ESLint errors. And no more errors will be added.

You can now decide with your team how you will handle this legacy and how to fix them.

You can visualize the size of the task with another package I created: [`eslint-disabled-stats`](https://www.npmjs.com/package/eslint-disabled-stats)

{% embed https://github.com/CorentinDoue/eslint-disabled-stats %}

```
$ npx eslint-disabled-stats -g -p "example/**/*.(js|ts)"

ℹ Analysing 2 files...
✔ Statistics computed

Rules disabled by rule:
• prefer-const: 1
• eqeqeq: 1
• curly: 1
• ALL_RULES: 1

Rules disabled by file:
• example/index.ts: 3
• example/legacy/legacy-file.js: 1

Total rules disabled:  4

Analysed files:        2
Analysed lines:        19

✔ Done
```

Depending on the estimated time to fix the errors, you can fix them **by batch** or opt for the **Boy Scout approach**.

With the Boy Scout approach, you leave the codebase cleaner after your intervention.

You fix the errors as you encounter them in your daily work. You will fix them when you have context on the code, and this will reduce the risk of regression.

Make sure to not accept any Pull Request with commented ESLint errors to ensure a continuous improvement of your codebase quality. Some tools can help you to automate this part of the review, such as [Danger JS](https://danger.systems/js/).

You can also use IDE extensions such as [TODO highlight](https://marketplace.visualstudio.com/items?itemName=wayou.vscode-todo-highlight) or [TODO Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree) to make visible and track the remaining errors directly in your IDE.

## 🚀 Conclusion

Enforcing ESLint rules from day one is a pivotal step towards codebase excellence. By leveraging the strategies discussed in this article, you can pave the way for a cleaner, more maintainable codebase.

But the journey doesn't end here. If you have questions or want to share your experiences, don't hesitate to reach out on [X/Twitter](https://x.com/CorentinDoue) or [GitHub](https://github.com/CorentinDoue)
