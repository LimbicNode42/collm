// Extend Vitest's expect with @testing-library/jest-dom matchers.
// Loaded in all environments — matchers that require DOM elements simply
// throw if called outside a jsdom context, which is the correct behaviour.
import '@testing-library/jest-dom';
