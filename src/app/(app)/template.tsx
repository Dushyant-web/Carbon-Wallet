/** Re-mounts on every navigation, so each page fades in (disabled for reduced-motion users). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="cw-page-in">{children}</div>;
}
