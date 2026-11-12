import { describe, expect, it } from 'vitest';

import {
  highlightSelectionSlice,
  highlightToggled,
  selectionCleared,
  selectSelectedHighlightIds,
} from './selectionSlice';

const reducer = highlightSelectionSlice.reducer;
const root = (state: ReturnType<typeof reducer>) => ({ highlightSelection: state });

describe('highlightSelectionSlice', () => {
  it('добавляет и убирает момент из нарезки', () => {
    let state = reducer(undefined, highlightToggled({ projectId: 'p1', highlightId: 'h1' }));
    state = reducer(state, highlightToggled({ projectId: 'p1', highlightId: 'h2' }));
    expect(selectSelectedHighlightIds(root(state), 'p1')).toEqual(['h1', 'h2']);

    state = reducer(state, highlightToggled({ projectId: 'p1', highlightId: 'h1' }));
    expect(selectSelectedHighlightIds(root(state), 'p1')).toEqual(['h2']);
  });

  it('держит выбор отдельно для каждого проекта', () => {
    const state = reducer(undefined, highlightToggled({ projectId: 'p1', highlightId: 'h1' }));
    expect(selectSelectedHighlightIds(root(state), 'p2')).toEqual([]);
  });

  it('сбрасывает выбор проекта', () => {
    let state = reducer(undefined, highlightToggled({ projectId: 'p1', highlightId: 'h1' }));
    state = reducer(state, selectionCleared('p1'));
    expect(selectSelectedHighlightIds(root(state), 'p1')).toEqual([]);
  });
});
