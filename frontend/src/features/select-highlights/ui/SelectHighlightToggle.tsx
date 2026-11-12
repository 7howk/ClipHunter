import { Check } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';

import {
  highlightToggled,
  selectSelectedHighlightIds,
  type HighlightSelectionRootState,
} from '../model/selectionSlice';

import styles from './SelectHighlightToggle.module.css';

interface SelectHighlightToggleProps {
  projectId: string;
  highlightId: string;
}

export function SelectHighlightToggle({ projectId, highlightId }: SelectHighlightToggleProps) {
  const dispatch = useDispatch();
  const selected = useSelector((state: HighlightSelectionRootState) =>
    selectSelectedHighlightIds(state, projectId).includes(highlightId),
  );

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={selected}
      onClick={() => dispatch(highlightToggled({ projectId, highlightId }))}
    >
      <span className={styles.box} aria-hidden="true">
        {selected && <Check />}
      </span>
      {selected ? 'В нарезке' : 'Добавить в нарезку'}
    </button>
  );
}
