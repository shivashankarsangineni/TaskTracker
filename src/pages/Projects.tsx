import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, UserPlus, Trash2 } from "lucide-react";
import { z } from "zod";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}
interface Profile { id: string; name: string; email: string }
interface Member { project_id: string; user_id: string }

const projectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});

export default function Projects() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [addToProject, setAddToProject] = useState<string | null>(null);
  const [selUserId, setSelUserId] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: pr }, { data: pf }, { data: pm }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, name, email"),
      supabase.from("project_members").select("project_id, user_id"),
    ]);
    setProjects((pr as Project[]) || []);
    setProfiles((pf as Profile[]) || []);
    setMembers((pm as Member[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = projectSchema.safeParse({
      name: fd.get("name"),
      description: fd.get("description") || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("projects").insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Project created"); setOpenNew(false); load(); }
  };

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this project and all its tasks?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const addMember = async () => {
    if (!addToProject || !selUserId) return;
    const { error } = await supabase.from("project_members").insert({
      project_id: addToProject, user_id: selUserId,
    });
    if (error) toast.error(error.message);
    else { toast.success("Member added"); setAddToProject(null); setSelUserId(""); load(); }
  };

  const removeMember = async (projectId: string, userId: string) => {
    const { error } = await supabase.from("project_members").delete()
      .eq("project_id", projectId).eq("user_id", userId);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Organize work into projects and add team members.</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
              <form onSubmit={createProject} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="np-name">Name</Label>
                  <Input id="np-name" name="name" required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="np-desc">Description</Label>
                  <Textarea id="np-desc" name="description" maxLength={500} />
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          No projects yet.{isAdmin && " Create one to get started."}
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const projectMembers = members.filter((m) => m.project_id === p.id);
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => deleteProject(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Members ({projectMembers.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {projectMembers.length === 0 && (
                        <span className="text-xs text-muted-foreground">No members</span>
                      )}
                      {projectMembers.map((m) => {
                        const prof = profiles.find((pf) => pf.id === m.user_id);
                        return (
                          <Badge key={m.user_id} variant="secondary" className="gap-2">
                            {prof?.name || "User"}
                            {isAdmin && (
                              <button
                                onClick={() => removeMember(p.id, m.user_id)}
                                className="ml-1 hover:text-destructive"
                                aria-label="Remove"
                              >×</button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setAddToProject(p.id); setSelUserId(""); }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />Add member
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!addToProject} onOpenChange={(o) => !o && setAddToProject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selUserId} onValueChange={setSelUserId}>
              <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
              <SelectContent>
                {profiles
                  .filter((pf) => !members.some((m) => m.project_id === addToProject && m.user_id === pf.id))
                  .map((pf) => (
                    <SelectItem key={pf.id} value={pf.id}>{pf.name} · {pf.email}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button onClick={addMember} disabled={!selUserId}>Add</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
