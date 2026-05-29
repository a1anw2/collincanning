/** Sidebar section label with optional add icon. */

export function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between px-4 text-white">
        <div className="opacity-75">{title}</div>
        <svg
          className="h-4 w-4 fill-current opacity-50"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4zm-1 11a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
        </svg>
      </div>
      {children}
    </div>
  );
}
