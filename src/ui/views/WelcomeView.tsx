export function WelcomeView({
  onStart,
  onExample,
  onResume,
  onNew,
  onOpenRecent,
  savedCount,
  lastName,
  recent,
}: {
  onStart: () => void;
  onExample: () => void;
  onResume?: () => void;
  onNew?: () => void;
  onOpenRecent?: (id: string) => void;
  savedCount?: number;
  lastName?: string;
  recent?: { id: string; name: string; klass: string }[];
}) {
  const returning = (savedCount ?? 0) > 0;

  return (
    <section className="welcome">
      <div className="welcome-inner">
        <p className="sys">AgentFit · Model 1.0</p>
        <h1 className="display mt-3">
          When should a workflow get an agent?
        </h1>
        <p className="lede">
          AgentFit scores economic opportunity, technical readiness, controllability, and risk before anyone
          writes an orchestration graph.
        </p>
        <ul className="thesis" aria-label="Core measures">
          <li>
            <b>Fit</b>
            <span>Opportunity — not a license</span>
          </li>
          <li>
            <b>Autonomy</b>
            <span>How independently to act</span>
          </li>
          <li>
            <b>Readiness</b>
            <span>Whether the environment can hold it</span>
          </li>
        </ul>
        <div className="welcome-actions">
          {returning && onResume ? (
            <button type="button" className="solid-btn" onClick={onResume}>
              {lastName?.trim() ? `Resume · ${lastName.trim()}` : "Resume last assessment"}
            </button>
          ) : (
            <button type="button" className="solid-btn" onClick={onStart}>
              Start assessment
            </button>
          )}
          {returning && onNew ? (
            <button type="button" className="line-btn" onClick={onNew}>
              New assessment
            </button>
          ) : null}
          <button type="button" className="line-btn" onClick={onExample}>
            Explore example
          </button>
        </div>
        {returning ? (
          <p className="hint mt-3">
            {`${savedCount} assessment${savedCount === 1 ? "" : "s"} on this device.`}
          </p>
        ) : null}
        {returning && recent && recent.length > 0 && onOpenRecent ? (
          <div className="recent">
            <p className="sys">Recent</p>
            <ul>
              {recent.map((item) => (
                <li key={item.id}>
                  <button type="button" className="link" onClick={() => onOpenRecent(item.id)}>
                    {item.name}
                  </button>
                  <span className="sys">{item.klass}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="privacy">
          Autonomy is a product decision, not a model-size decision. Your workflow assessments remain on this
          device unless you explicitly export them.
        </p>
      </div>
    </section>
  );
}
