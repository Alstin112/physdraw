interface TagFilterProps {
  name: string;
  checked: boolean;
  disabled?: boolean;
  toggleCheck?: () => void;
}

export function TagFilter({ name, checked, toggleCheck, disabled }: TagFilterProps) {
  return (
    <button
      className={`tag-container ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}`}
      onClick={toggleCheck}
      disabled={disabled}
    >
      <span>{name}</span>
      <div className="tag-options"></div>
    </button>
  );
}