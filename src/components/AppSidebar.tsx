import {
  Activity,
  BarChart3,
  GitBranch,
  Layers,
  Link,
  PlayCircle,
  Shield,
  Timer,
  Skull,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAppContext } from "@/lib/store";

const navItems = [
  { title: "Connect", url: "/", icon: Link },
  { title: "Overview", url: "/overview", icon: Activity },
  { title: "Cardinality", url: "/cardinality", icon: BarChart3 },
  { title: "Histograms", url: "/histograms", icon: Layers },
  { title: "Labels", url: "/labels", icon: GitBranch },
  { title: "Scrapes", url: "/scrapes", icon: Timer },
  { title: "Simulate", url: "/simulate", icon: PlayCircle },
  { title: "Recommendations", url: "/recommendations", icon: Shield },
];

export function AppSidebar() {
  const { connection } = useAppContext();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Skull className="h-6 w-6 text-severity-critical shrink-0" />
          <span className="font-bold text-lg tracking-tight group-data-[collapsible=icon]:hidden">
            Autopsy
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isDisabled = item.url !== "/" && !connection.isConnected;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      {isDisabled ? (
                        <span className="flex items-center gap-2 opacity-40 cursor-not-allowed px-2 py-1.5">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </span>
                      ) : (
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                          activeClassName="bg-sidebar-accent text-primary font-medium"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </NavLink>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {connection.isConnected && (
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="h-2 w-2 rounded-full bg-severity-healthy shrink-0" />
            <span className="text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
              Connected
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
