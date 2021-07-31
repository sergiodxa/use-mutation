import { Reducer, useCallback, useReducer, useRef } from 'react';
import useSafeCallback from 'use-safe-callback';

export type rollbackFn = () => void;

export interface Options<Input, Data, Error> {
  /**
   * A function to be executed before the mutation runs.
   *
   * It receives the same input as the mutate function.
   *
   * It can be an async or sync function, in both cases if it returns a function
   * it will keep it as a way to rollback the changed applied inside onMutate.
   */
  onMutate?(params: {
    input: Input;
  }): Promise<rollbackFn | void> | rollbackFn | void;
  /**
   * A function to be executed after the mutation resolves successfully.
   *
   * It receives the result of the mutation.
   *
   * If a Promise is returned, it will be awaited before proceeding.
   */
  onSuccess?(params: { data: Data; input: Input }): Promise<void> | void;
  /**
   * A function to be executed after the mutation failed to execute.
   *
   * If a Promise is returned, it will be awaited before proceeding.
   */
  onFailure?(params: {
    error: Error;
    rollback: rollbackFn | void;
    input: Input;
  }): Promise<void> | void;
  /**
   * A function to be executed after the mutation has resolves, either
   * successfully or as failure.
   *
   * This function receives the error or the result of the mutation.
   * It follow the normal Node.js callback style.
   *
   * If a Promise is returned, it will be awaited before proceeding.
   */
  onSettled?(
    params:
      | { status: 'success'; data: Data; input: Input }
      | {
          status: 'failure';
          error: Error;
          rollback: rollbackFn | void;
          input: Input;
        }
  ): Promise<void> | void;
  /**
   * If defined as `true`, a failure in the mutation will cause the `mutate`
   * function to throw. Disabled by default.
   */
  throwOnFailure?: boolean;
  /**
   * If defined as `true`, a failure in the mutation will cause the Hook to
   * throw in render time, making error boundaries catch the error.
   */
  useErrorBoundary?: boolean;
}

export type Status = 'idle' | 'running' | 'success' | 'failure';

function noop() {}

/**
 * Get the latest value received as parameter, useful to be able to dynamically
 * read a value from params inside a callback or effect without cleaning and
 * running again the effect or recreating the callback.
 */
function useGetLatest<Value>(value: Value): () => Value {
  const ref = useRef<Value>(value);
  ref.current = value;
  return useCallback(() => ref.current, []);
}

export type Reset = () => void;

export type MutationResult<Input, Data, Error> = [
  (input: Input) => Promise<Data | undefined>,
  { status: Status; data?: Data; error?: Error; reset: Reset }
];

/**
 * Hook to run async function which cause a side-effect, specially useful to
 * run requests against an API
 */
export default function useMutation<Input = any, Data = any, Error = any>(
  mutationFn: (input: Input) => Promise<Data>,
  {
    onMutate = () => noop,
    onSuccess = noop,
    onFailure = noop,
    onSettled = noop,
    throwOnFailure = false,
    useErrorBoundary = false,
  }: Options<Input, Data, Error> = {}
): MutationResult<Input, Data, Error> {
  type State = { status: Status; data?: Data; error?: Error };

  type Action =
    | { type: 'RESET' }
    | { type: 'MUTATE' }
    | { type: 'SUCCESS'; data: Data }
    | { type: 'FAILURE'; error: Error };

  const [{ status, data, error }, unsafeDispatch] = useReducer<
    Reducer<State, Action>
  >(
    function reducer(_, action) {
      if (action.type === 'RESET') {
        return { status: 'idle' };
      }
      if (action.type === 'MUTATE') {
        return { status: 'running' };
      }
      if (action.type === 'SUCCESS') {
        return { status: 'success', data: action.data };
      }
      if (action.type === 'FAILURE') {
        return { status: 'failure', error: action.error };
      }
      throw Error('Invalid action');
    },
    { status: 'idle' }
  );

  const getMutationFn = useGetLatest(mutationFn);
  const latestMutation = useRef(0);

  const safeDispatch = useSafeCallback(unsafeDispatch);

  /**
   * Run your mutation function, this function receives an input value and pass
   * it directly to your mutation function.
   */
  const mutate = useCallback(async function mutate(
    input: Input,
    config: Omit<
      Options<Input, Data, Error>,
      'onMutate' | 'useErrorBoundary'
    > = {}
  ) {
    const mutation = Date.now();
    latestMutation.current = mutation;

    safeDispatch({ type: 'MUTATE' });
    const rollback = (await onMutate({ input })) ?? noop;

    try {
      const data = await getMutationFn()(input);

      if (latestMutation.current === mutation) {
        safeDispatch({ type: 'SUCCESS', data });
      }

      await onSuccess({ data, input });
      await (config.onSuccess ?? noop)({ data, input });

      await onSettled({ status: 'success', data, input });
      await (config.onSettled ?? noop)({ status: 'success', data, input });

      return data;
    } catch (error) {
      await onFailure({ error, rollback, input });
      await (config.onFailure ?? noop)({ error, rollback, input });

      await onSettled({ status: 'failure', error, input, rollback });
      await (config.onSettled ?? noop)({
        status: 'failure',
        error,
        input,
        rollback,
      });

      if (latestMutation.current === mutation) {
        safeDispatch({ type: 'FAILURE', error });
      }

      if (config.throwOnFailure ?? throwOnFailure) throw error;

      return;
    }
  },
  []);

  const reset = useCallback(function reset() {
    safeDispatch({ type: 'RESET' });
  }, []);

  if (useErrorBoundary && error) throw error;

  return [mutate, { status, data, error, reset }];
}
