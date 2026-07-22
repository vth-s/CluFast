interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
}

interface ServerSidebarProps {
  servers: Server[];
  activeServerId: string | null;
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ServerSidebar({
  servers,
  activeServerId,
  onSelectServer,
  onCreateServer,
}: ServerSidebarProps) {
  return (
    <div className="flex w-[72px] flex-col items-center gap-2 overflow-y-auto bg-zinc-950 py-3">
      {servers.map((server) => {
        const active = server.id === activeServerId;
        return (
          <button
            key={server.id}
            onClick={() => onSelectServer(server.id)}
            title={server.name}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl text-xs font-bold text-white transition-all duration-200 ${
              active
                ? "rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                : "rounded-2xl bg-zinc-800 text-zinc-400 hover:rounded-xl hover:bg-indigo-600 hover:text-white"
            }`}
          >
            {active && (
              <span className="absolute -left-3 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-white" />
            )}
            {server.iconUrl ? (
              <img
                src={server.iconUrl}
                alt={server.name}
                className="h-full w-full rounded-[inherit] object-cover"
              />
            ) : (
              getInitials(server.name)
            )}
          </button>
        );
      })}

      <div className="my-1 h-px w-8 bg-zinc-800" />

      <button
        onClick={onCreateServer}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-xl font-bold text-green-500 transition-all duration-200 hover:rounded-xl hover:bg-green-600 hover:text-white"
        title="Add a Server"
      >
        +
      </button>
    </div>
  );
}
