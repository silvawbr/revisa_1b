/**
 * Binds the same visual-selection action to mouse, touch and keyboard input.
 * Native buttons provide the mouse, touch and assistive-technology semantics; the
 * key handler keeps Enter and Space on the same explicit activation path.
 */
export function createVisualSelectionInteraction({
  options = [],
  onSelect = () => {},
} = {}) {
  const optionElements = [...options].filter(Boolean);
  let destroyed = false;

  function select(option, event) {
    if (destroyed || option.disabled) return;
    const shapeKey = option.dataset?.shapeOption;
    if (shapeKey) onSelect(shapeKey, event);
  }

  function handleClick(event) {
    select(event.currentTarget, event);
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault?.();
    select(event.currentTarget, event);
  }

  optionElements.forEach((option) => {
    option.addEventListener('click', handleClick);
    option.addEventListener('keydown', handleKeydown);
  });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      optionElements.forEach((option) => {
        option.removeEventListener('click', handleClick);
        option.removeEventListener('keydown', handleKeydown);
      });
    },
  };
}
