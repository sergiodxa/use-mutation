<div align="center">

<h1>
  useMutation
</h1>

<a href="https://www.joypixels.com/profiles/emoji/dna">
  <img
    height="80"
    width="80"
    alt="dna"
    src="https://raw.githubusercontent.com/sergiodxa/use-mutation/master/other/logo.png"
  />
</a>

<p>
  Run side-effects safely in React
</p>

</div>

<hr />

![CI](https://github.com/sergiodxa/use-mutation/workflows/CI/badge.svg) ![Publish](https://github.com/sergiodxa/use-mutation/workflows/Publish/badge.svg)


Specially useful to run requests against an API, and combined with [SWR](https://swr.vercel.app).

## Usage

Install it:

```sh
$ yarn add use-mutation
```

Import it:

```ts
import useMutation from 'use-mutation';
```

Create a function which runs a mutation

```tsx
async function createComment({
  authorId,
  comment,
}: {
  authorId: number;
  comment: string;
}) {
  const res = await fetch('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ authorId, comment }),
  });
  if (!res.ok) throw new Error(res.statusText);
  return await res.json();
}
```

Use your function with `useMutation`

```tsx
function CommentForm({ authorId }) {
  const [comment, setComment] = React.useState('');
  const [mutate, { status }] = useMutation(createComment, {
    onMutate({ input }) {
      // do something before the mutation run
      return () => {
        // rollback changes if the mutation failed
      };
    },
    onSuccess({ data, input }) {
      // do something once the mutation succeeded
    },
    onFailure({ error, rollback, input }) {
      // do something once the mutation failed
    },
    onSettled({ status, error, data, rollback, input }) {
      switch (status) {
        case 'success': {
          // do something if the mutation succeeded
        }
        case 'failure': {
          // do something if the mutation failed
        }
      }
    },
  });

  const handleSubmit = React.useCallback(
    function handleSubmit(event) {
      mutate({ authorId, comment });
    },
    [mutate, comment]
  );

  // render your UI
}
```

### Usage with SWR

If you are using SWR, you can use `useMutation` to run your mutations to perform Optimistic UI changes.

```tsx
import { cache, mutate } from 'swr';

function createComment(input) {
  // ...
}

function useCreateComment() {
  return useMutation(createComment, {
    onMutate({ input }) {
      const oldData = cache.get('comment-list');
      // optimistically update the data before your mutation is run
      mutate('comment-list', current => current.concat(input), false);
      return () => mutate('comment-list', oldData, false); // revalidate if it failed
    },

    onFailure({ status, rollback }) {
      if (status === 'failure' && rollback) rollback();
    },
  });
}
```

This way when you run `mutate`, it will first optimistically update your SWR cache and if it fails it will rollback to the old data.

## API Reference

```tsx
const [mutate, { status, data, error, reset }] = useMutation<
  Input,
  Data,
  Error
>(mutationFn, {
  onMutate,
  onSuccess,
  onFailure,
  onSettled,
  throwOnFailure,
  useErrorBoundary,
});

const promise = mutate(input, {
  onSuccess,
  onSettled,
  onError,
  throwOnFailure,
});
```

### Hook Generic

> Only if you are using TypeScript

- `Input = any`
  - The data your mutation function needs to run
- `Data = any`
  - The data the hook will return as result of your mutation
- `Error = any`
  - The error the hook will return as a failure in your mutation

### Hook Options

- `mutationFn(input: Input): Promise<Data>`
  - **Required**
  - A function to be executed before the mutation runs.
  - It receives the same input as the mutate function.
  - It can be an async or sync function, in both cases if it returns a function it will keep it as a way to rollback the changed applied inside onMutate.
- `onMutate?({ input: Input }): Promise<rollbackFn | undefined> | rollbackFn | undefined`
  - Optional
  - A function to be executed before the mutation runs.
  - It receives the same input as the mutate function.
  - It can be an async or sync function, in both cases if it returns a function.
  - it will keep it as a way to rollback the changed applied inside `onMutate`
- `onSuccess?({ data: Data, input: Input }): Promise<void> | void`
  - Optional
  - A function to be executed after the mutation resolves successfully.
  - It receives the result of the mutation.
  - If a Promise is returned, it will be awaited before proceeding.
- `onFailure?({ error: Error, rollback: rollbackFn, input: Input }): Promise<void> | void`
  - Optional
  - A function to be executed after the mutation failed to execute.
  - If a Promise is returned, it will be awaited before proceeding.
- `onSettled?({ status: 'success' | 'failure', error?: Error, data?: Data, rollback?: rollbackFn, input: Input}): Promise<void> | void`
  - Optional
  - A function to be executed after the mutation has resolves, either successfully or as failure.
  - This function receives the error or the result of the mutation.
  - If a Promise is returned, it will be awaited before proceeding.
- `throwOnFailure?: boolean`
  - Optional
  - If defined as `true`, a failure in the mutation will cause the `mutate` function to throw. Disabled by default.
- `useErrorBoundary?: boolean` (default false)
  - Optional
  - If defined as `true`, a failure in the mutation will cause the Hook to throw in render time, making error boundaries catch the error.

### Hook Returned Value

- `mutate(input: Input, config: Omit<Options<Input, Data, Error>, 'onMutate' | 'useErrorBoundary'> = {}): Promise<Data | undefined>`
  - The function you call to trigger your mutation, passing the input your mutation function needs.
  - All the lifecycle callback defined here will run _after_ the callback defined in the Hook.
- `status: 'idle' | 'running' | 'success' | 'failure'`
  - The current status of the mutation, it will be:
    - `idle` initial status of the hook, and the status after a reset
    - `running` if the mutation is currently running
    - `success` if the mutation resolved successfully
    - `failure` if the mutation failed to resolve
- `data: Data`
  - The data returned as the result of the mutation.
- `error: Error`
  - The error returned as the result of the mutation.
- `reset(): void
  - A function to reset the internal state of the Hook to the orignal idle and clear any data or error.

## Author

- [Sergio Xalambrí](https://sergiodxa.com) - [Able](https://able.co)

## License

The MIT License.
