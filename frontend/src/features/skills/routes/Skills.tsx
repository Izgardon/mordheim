import { useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { Card, CardContent, CardHeader } from "@components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import CreateSkillDialog from "../components/CreateSkillDialog";
import EditSkillDialog from "../components/EditSkillDialog";
import { Input } from "@components/input";

// api
import { listSkills } from "../api/skills-api";
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

// types
import type { Skill } from "../types/skill-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

const ALL_TYPES = "all";

const formatType = (value: string) => value.replace(/_/g, " ");

export default function Skills() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);

  const canCreate =
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes("manage_skills");
  const canManage = canCreate;

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const campaignId = Number(id);
    listSkills(Number.isNaN(campaignId) ? {} : { campaignId })
      .then((data) => setSkills(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load skills");
        } else {
          setError("Unable to load skills");
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (campaign?.role !== "player" || !id) {
      return;
    }

    const campaignId = Number(id);
    if (Number.isNaN(campaignId)) {
      return;
    }

    listMyCampaignPermissions(campaignId)
      .then((permissions) => setMemberPermissions(permissions.map((permission) => permission.code)))
      .catch(() => setMemberPermissions([]));
  }, [campaign?.role, id]);

  const typeOptions = useMemo(() => {
    const unique = new Set(skills.map((skill) => skill.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [skills]);

  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const byType = selectedType === ALL_TYPES ? skills : skills.filter((skill) => skill.type === selectedType);
    if (!query) {
      return byType;
    }
    return byType.filter((skill) => {
      const haystack = [skill.name, skill.type, skill.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [skills, searchQuery, selectedType]);

  const handleCreated = (newSkill: Skill) => {
    setSkills((prev) => [newSkill, ...prev]);
  };

  const handleUpdated = (updatedSkill: Skill) => {
    setSkills((prev) =>
      prev.map((skill) => (skill.id === updatedSkill.id ? updatedSkill : skill))
    );
  };

  const handleDeleted = (skillId: number) => {
    setSkills((prev) => prev.filter((skill) => skill.id !== skillId));
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Skills</h1>
          </div>
          {canCreate ? (
            <CreateSkillDialog campaignId={Number(id)} onCreated={handleCreated} typeOptions={typeOptions} />
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filter by discipline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All disciplines</SelectItem>
                  {typeOptions.map((typeOption) => (
                    <SelectItem key={typeOption} value={typeOption}>
                      {formatType(typeOption)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full max-w-sm">
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search skills..."
                aria-label="Search skills"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Gathering the disciplines...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filteredSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills logged yet.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-[0_12px_24px_rgba(5,20,24,0.3)]">
              <table className="min-w-full table-fixed divide-y divide-border/70 text-sm">
                <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="w-[20%] px-4 py-3 text-left font-semibold">Name</th>
                    <th className="w-[15%] px-4 py-3 text-left font-semibold">Type</th>
                    <th className="w-[55%] px-4 py-3 text-left font-semibold">Description</th>
                    {canManage ? (
                      <th className="w-[10%] px-4 py-3 text-left font-semibold">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredSkills.map((skill) => (
                    <tr
                      key={skill.id}
                      className="bg-transparent odd:bg-background/60 even:bg-card/60 hover:bg-accent/20"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{skill.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatType(skill.type)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{skill.description}</td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          {skill.campaign_id ? (
                            <EditSkillDialog
                              skill={skill}
                              typeOptions={typeOptions}
                              onUpdated={handleUpdated}
                              onDeleted={handleDeleted}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">Core</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}





