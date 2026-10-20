export function BotIcon({
  color = "#f6bd4f",
  small = false,
}: {
  color?: string;
  small?: boolean;
}) {
  return (
    <div
      className={`bot-icon ${small ? "small" : ""}`}
      style={{ "--bot": color } as React.CSSProperties}
    >
      <i />
      <span>
        <b />
        <b />
      </span>
      <em />
    </div>
  );
}