interface SectionIntroProps {
  eyebrow: string;
  title: string;
  lead: string;
  inverse?: boolean;
}

export function SectionIntro({ eyebrow, title, lead, inverse = false }: SectionIntroProps) {
  return (
    <div className="section-intro" data-inverse={inverse || undefined}>
      <p className="section-intro__eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="section-intro__lead">{lead}</p>
    </div>
  );
}
