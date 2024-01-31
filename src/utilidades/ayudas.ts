function parseAsNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && !isNaN(value)) return parseFloat(value);
  if (Array.isArray(value)) return value.map((item) => parseAsNumber(item));
  if (typeof value === 'object')
    return Object.keys(value).reduce(
      (acc, key) => ({
        ...acc,
        [key]: parseAsNumber(value[key]),
      }),
      {}
    );
  return value;
}
