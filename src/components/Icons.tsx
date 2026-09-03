type IconProps = { className?: string };

const base = "stroke-current";

export function IconHoy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLeads({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <rect x="3.5" y="5" width="17" height="4.2" rx="1.2" />
      <rect x="3.5" y="10.9" width="17" height="4.2" rx="1.2" />
      <rect x="3.5" y="16.8" width="17" height="4.2" rx="1.2" />
    </svg>
  );
}

export function IconCalendario({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

export function IconMas({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} className={`${base} ${className ?? ""}`}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function IconPerfil({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconTelefono({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <path
        d="M6.5 4h2.7l1.3 4-2 1.3a11 11 0 0 0 5.2 5.2l1.3-2 4 1.3v2.7c0 1-.9 1.8-1.9 1.6-6-1-11-6-12-12C4.7 4.9 5.5 4 6.5 4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconWhatsapp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <path
        d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.2A8.5 8.5 0 1 0 12 3.5Z"
        strokeLinejoin="round"
      />
      <path
        d="M9 9c0 3.5 2.5 6 6 6l.6-1.2c.2-.4-.1-.9-.5-1l-1.4-.4c-.3-.1-.6 0-.8.3l-.3.4a5 5 0 0 1-2.7-2.7l.4-.3c.2-.2.4-.5.3-.8l-.4-1.4c-.1-.4-.6-.7-1-.5L9 9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} className={`${base} ${className ?? ""}`}>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlerta({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <path d="M12 4 3 20h18L12 4Z" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFiltro({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

export function IconBuscar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.2} className={`${base} ${className ?? ""}`}>
      <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAnalitica({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <path d="M4 20V10M11 20V4M18 20v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrendUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} className={`${base} ${className ?? ""}`}>
      <path d="M4 16l5.5-5.5L13 14l7-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrendDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} className={`${base} ${className ?? ""}`}>
      <path d="M4 8l5.5 5.5L13 10l7 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 17h5v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconImportar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 16.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMasOpciones({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className ?? ""}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function IconCampana({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" strokeLinejoin="round" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
    </svg>
  );
}

export function IconUsuarios({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className ?? ""}`}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 19c1.1-3.2 3.6-5 6.5-5s5.4 1.8 6.5 5" strokeLinecap="round" />
      <path d="M16 4.2c1.5.4 2.5 1.7 2.5 3.3s-1 2.9-2.5 3.3M19 14.3c1.5.5 2.6 1.9 3 3.7" strokeLinecap="round" />
    </svg>
  );
}
