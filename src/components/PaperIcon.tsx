import imgUnderConst from "./../assets/under-construction.jpg";
import imgPaper from "./../assets/paper.png";

interface PaperIconProps {
  title: string;
  description: string | null;
  errored: boolean;
  onDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  selected?: boolean;
}
export function PaperIcon({ title, description, errored, onDown, onUp, selected }: PaperIconProps) {
  return (
    <div className={`paper-icon ${errored ? "paper-icon errored" : "paper-icon"} ${selected ? "selected" : ""}`} onMouseDown={onDown} onMouseUp={onUp}>
      <img src={errored ? imgUnderConst : imgPaper} alt={title} />
      <div className="paper-info">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}