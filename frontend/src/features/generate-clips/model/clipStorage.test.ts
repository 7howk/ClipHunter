import { beforeEach, describe, expect, it } from 'vitest';

import { loadGeneratedClips, saveGeneratedClips } from './clipStorage';

const state = { byProject: { p1: [{ clipId: 'c1', highlightId: 'h1' }] } };

describe('clipStorage', () => {
  beforeEach(() => localStorage.clear());

  it('возвращает сохранённые клипы', () => {
    saveGeneratedClips(state);
    expect(loadGeneratedClips()).toEqual(state);
  });

  it('переживает испорченные данные', () => {
    localStorage.setItem('cliphunter.generatedClips', '{не json');
    expect(loadGeneratedClips()).toEqual({ byProject: {} });

    localStorage.setItem('cliphunter.generatedClips', '{"p1":[{"clipId":1}],"p2":"x"}');
    expect(loadGeneratedClips()).toEqual({ byProject: { p1: [] } });
  });
});
