// Small arithmetic parser for inspector values. It deliberately avoids eval
// and accepts only numbers, parentheses and the four basic operators.
export function parseNumericExpression(source: string, unit = ''): number | null {
  if (source.length > 96) return null;

  let input = source.trim();
  if (!input) return null;

  const normalizedUnit = unit.trim();
  if (normalizedUnit && input.endsWith(normalizedUnit)) {
    input = input.slice(0, -normalizedUnit.length).trim();
  }

  input = input
    .replace(/,/g, '.')
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '');

  let index = 0;

  const parseExpression = (): number | null => {
    let value = parseTerm();
    if (value === null) return null;
    while (input[index] === '+' || input[index] === '-') {
      const operator = input[index++];
      const right = parseTerm();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number | null => {
    let value = parseUnary();
    if (value === null) return null;
    while (input[index] === '*' || input[index] === '/') {
      const operator = input[index++];
      const right = parseUnary();
      if (right === null || (operator === '/' && right === 0)) return null;
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };

  const parseUnary = (): number | null => {
    if (input[index] === '+') {
      index += 1;
      return parseUnary();
    }
    if (input[index] === '-') {
      index += 1;
      const value = parseUnary();
      return value === null ? null : -value;
    }
    return parsePrimary();
  };

  const parsePrimary = (): number | null => {
    if (input[index] === '(') {
      index += 1;
      const value = parseExpression();
      if (value === null || input[index] !== ')') return null;
      index += 1;
      return value;
    }

    const start = index;
    let sawDigit = false;
    let sawDot = false;
    while (index < input.length) {
      const char = input[index];
      if (char >= '0' && char <= '9') {
        sawDigit = true;
        index += 1;
      } else if (char === '.' && !sawDot) {
        sawDot = true;
        index += 1;
      } else {
        break;
      }
    }
    if (!sawDigit) return null;
    const value = Number(input.slice(start, index));
    return Number.isFinite(value) ? value : null;
  };

  const result = parseExpression();
  return result !== null && index === input.length && Number.isFinite(result) ? result : null;
}
