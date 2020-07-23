import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useMutation from '../src';
// @ts-ignore
import MutationObserver from 'mutation-observer';

window.MutationObserver = MutationObserver;

function Tester({
  mutationFn,
  onMutate,
  onSuccess,
  onFailure,
  onSettled,
}: {
  mutationFn: () => Promise<any>;
  onMutate: () => any;
  onSuccess: () => any;
  onFailure: () => any;
  onSettled: () => any;
}) {
  const [mutate, { status }] = useMutation(mutationFn, {
    onMutate,
    onSuccess,
    onFailure,
    onSettled,
  });

  return <button onClick={() => mutate('test-1')}>{status}</button>;
}

describe(useMutation, () => {
  test('should call all the correct function for a successful mutation', async () => {
    const mutationFn = jest.fn(() => Promise.resolve('result-1'));
    const onMutate = jest.fn();
    const onSuccess = jest.fn();
    const onFailure = jest.fn();
    const onSettled = jest.fn();

    render(
      <Tester
        mutationFn={mutationFn}
        onMutate={onMutate}
        onSuccess={onSuccess}
        onFailure={onFailure}
        onSettled={onSettled}
      />
    );

    userEvent.click(screen.getByRole('button'));

    await screen.findByText('running');

    expect(mutationFn).toHaveBeenCalledWith('test-1');
    expect(onMutate).toHaveBeenCalledWith('test-1');
    expect(onSuccess).toHaveBeenCalledWith('result-1');
    expect(onFailure).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(undefined, 'result-1');
  });

  test('should call all the correct function for a failure mutation', async () => {
    const noop = jest.fn();
    const mutationFn = jest.fn(() => Promise.reject('reason-1'));
    const onMutate = jest.fn(() => noop);
    const onSuccess = jest.fn();
    const onFailure = jest.fn();
    const onSettled = jest.fn();

    render(
      <Tester
        mutationFn={mutationFn}
        onMutate={onMutate}
        onSuccess={onSuccess}
        onFailure={onFailure}
        onSettled={onSettled}
      />
    );

    userEvent.click(screen.getByRole('button'));

    await screen.findByText('running');

    expect(mutationFn).toHaveBeenCalledWith('test-1');
    expect(onMutate).toHaveBeenCalledWith('test-1');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith('reason-1', noop);
    expect(onSettled).toHaveBeenCalledWith('reason-1', undefined, noop);
  });
});
