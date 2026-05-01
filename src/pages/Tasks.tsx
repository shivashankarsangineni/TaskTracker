import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type Status = "todo" | "in_progress" | "done";
interface Task {
  id: string; title: string; description: string | null;
  project_id: string; assigned_to: string | null;
  status: Status; due_date: string | null;
}
interface Project { id: string; name: string }
interface Profile { id: string; name: string }

const taskSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
  project_id: z.string().uuid(),
  assigned_to: z.string().uuid().optional(),
  due_date: z.string().optional(),
});

const statusOpts: { value: Status; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

export default function Tasks() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: pr }, { data: pf }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name"),
      supabase.from("profiles").select("id, name"),
    ]);
    setTasks((t as Task[]) || []);
    setProjects((pr as Project[]) || []);
    setProfiles((pf as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = taskSchema.safeParse({
      title: fd.get("title"),
      description: fd.get("description") || undefined,
      project_id: fd.get("project_id"),
      assigned_to: fd.get("assigned_to") || undefined,
      due_date: fd.get("due_date") || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      project_id: parsed.data.project_id,
      assigned_to: parsed.data.assigned_to ?? null,
      due_date: parsed.data.due_date || null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Task created"); setOpenNew(false); load(); }
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t))); }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const today = new Date().toISOString().slice(0, 10);
  const filtered = tasks.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Manage all tasks." : "Tasks assigned to you and your projects."}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
              <form onSubmit={createTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="t-title">Title</Label>
                  <Input id="t-title" name="title" required maxLength={150} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-desc">Description</Label>
                  <Textarea id="t-desc" name="description" maxLength={1000} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-proj">Project</Label>
                  <select id="t-proj" name="project_id" required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-assign">Assign to</Label>
                  <select id="t-assign" name="assigned_to"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Unassigned</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-due">Due date</Label>
                  <Input id="t-due" name="due_date" type="date" />
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..." className="pl-9 w-64"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Status | "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOpts.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground p-6">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No tasks found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const proj = projects.find((p) => p.id === t.project_id);
                  const assignee = profiles.find((p) => p.id === t.assigned_to);
                  const isOverdue = t.status !== "done" && t.due_date && t.due_date < today;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="text-muted-foreground">{proj?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{assignee?.name || "Unassigned"}</TableCell>
                      <TableCell>
                        {t.due_date ? (
                          <span className={isOverdue ? "text-destructive" : "text-muted-foreground"}>
                            {t.due_date}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v as Status)}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {statusOpts.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteTask(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
