export function orderedSessionWriter<T>(write: (value: T) => Promise<void>) {
  let pending = Promise.resolve();
  return (value: T, isCurrent: () => boolean) => {
    const result = pending
      .catch(() => {})
      .then(async () => {
        if (isCurrent()) await write(value);
      });
    pending = result;
    return result;
  };
}
