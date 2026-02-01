import { useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { CardBackground } from "@components/card-background";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import { ScrollArea } from "@components/scroll-area";
import { PageHeader } from "@components/page-header";
import CreateSkillDialog from "../components/CreateSkillDialog";
import EditSkillDialog from "../components/EditSkillDialog";
import { Input } from "@components/input";
import { Button } from "@components/button";

// api
import { listSkills } from "../api/skills-api";
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

// types
import type { Skill } from "../types/skill-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

const ALL_TYPES = "all";
const PRIORITY_TYPES = [
  "Combat Skills",
  "Shooting Skills",
  "Strength Skills",
  "Speed Skills",
  "Academic Skills",
];

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

  const canAdd =
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes("add_skills");

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
      return byType
        .slice()
        .sort((a, b) => {
          const aPriority = PRIORITY_TYPES.indexOf(a.type);
          const bPriority = PRIORITY_TYPES.indexOf(b.type);
          const aRank = aPriority === -1 ? Number.POSITIVE_INFINITY : aPriority;
          const bRank = bPriority === -1 ? Number.POSITIVE_INFINITY : bPriority;
          if (aRank !== bRank) {
            return aRank - bRank;
          }
          const typeCompare = a.type.localeCompare(b.type);
          if (typeCompare !== 0) {
            return typeCompare;
          }
          return a.name.localeCompare(b.name);
        });
    }
    return byType
      .filter((skill) => {
        const haystack = [skill.name, skill.type, skill.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aPriority = PRIORITY_TYPES.indexOf(a.type);
        const bPriority = PRIORITY_TYPES.indexOf(b.type);
        const aRank = aPriority === -1 ? Number.POSITIVE_INFINITY : aPriority;
        const bRank = bPriority === -1 ? Number.POSITIVE_INFINITY : bPriority;
        if (aRank !== bRank) {
          return aRank - bRank;
        }
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) {
          return typeCompare;
        }
        return a.name.localeCompare(b.name);
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
      <div className="h-full flex flex-col gap-6 overflow-hidden">
        <PageHeader title="Skills" subtitle="Combat disciplines and abilities" />

      <CardBackground className="flex min-h-0 flex-1 flex-col gap-4 p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full max-w-sm">
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search skills..."
                aria-label="Search skills"
              />
            </div>
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
          <div className="flex items-center">
            {canAdd ? (
              <CreateSkillDialog
                campaignId={Number(id)}
                onCreated={handleCreated}
                typeOptions={typeOptions}
              />
            ) : null}
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Gathering the disciplines...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills logged yet.</p>
        ) : (
          <ScrollArea className="table-scroll table-scroll--full flex-1 min-h-0">
            <table className="min-w-full table-fixed divide-y border border-border/60 text-sm">
              <thead className="bg-black text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="w-[20%] px-4 py-3 text-left font-semibold">Name</th>
                  <th className="w-[15%] px-4 py-3 text-left font-semibold">Type</th>
                  <th className="w-[55%] px-4 py-3 text-left font-semibold">Description</th>
                  <th className="w-[10%] px-4 py-3 text-left font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSkills.map((skill) => (
                  <tr
                    key={skill.id}
                    className="bg-transparent hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{skill.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatType(skill.type)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{skill.description}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" size="sm">
                          Assign
                        </Button>
                        {skill.campaign_id ? (
                          <EditSkillDialog
                            skill={skill}
                            typeOptions={typeOptions}
                            onUpdated={handleUpdated}
                            onDeleted={handleDeleted}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardBackground>
    </div>
  );
}
