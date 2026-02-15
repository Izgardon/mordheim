import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// store
import { useAppStore } from "@/stores/app-store";

// components
import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import { TableSkeleton } from "@components/table-skeleton";
import { PageHeader } from "@components/page-header";
import AddSkillForm from "../components/AddSkillForm";
import LearnSkillDialog from "../components/LearnSkillDialog";
import SkillsTable from "../components/SkillsTable";
import { Input } from "@components/input";
import { Tooltip } from "@components/tooltip";
import basicBar from "@/assets/containers/basic_bar.webp";
import editIcon from "@/assets/components/edit.webp";

// api
import { listSkills } from "../api/skills-api";
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

// types
import type { Skill } from "../types/skill-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

const ALL_TYPES = "all";
const PRIORITY_TYPES = [
  "Combat",
  "Shooting",
  "Strength",
  "Speed",
  "Academic",
];

const formatType = (value: string) => value.replace(/_/g, " ");

const SKILL_ROW_BG_STYLE: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
};

export default function Skills() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);
  const campaignKey = Number.isNaN(campaignId) ? "base" : `campaign:${campaignId}`;
  const { skillsCache, setSkillsCache, upsertSkillCache, removeSkillCache } = useAppStore();
  const cachedSkills = skillsCache[campaignKey];
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const canAdd =
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes("add_custom");

  useEffect(() => {
    if (cachedSkills?.loaded) {
      setSkills(cachedSkills.data);
      setIsLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError("");

    listSkills(Number.isNaN(campaignId) ? {} : { campaignId })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setSkills(data);
        setSkillsCache(campaignKey, data);
      })
      .catch((errorResponse) => {
        if (cancelled) {
          return;
        }
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load skills");
        } else {
          setError("Unable to load skills");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cachedSkills, campaignId, campaignKey, setSkillsCache]);

  useEffect(() => {
    if (campaign?.role !== "player" || !id) {
      return;
    }

    if (Number.isNaN(campaignId)) {
      return;
    }

    listMyCampaignPermissions(campaignId)
      .then((permissions) => setMemberPermissions(permissions.map((permission) => permission.code)))
      .catch(() => setMemberPermissions([]));
  }, [campaign?.role, campaignId, id]);

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
    upsertSkillCache(campaignKey, newSkill);
    setIsFormOpen(false);
    setEditingSkill(null);
  };

  const handleUpdated = (updatedSkill: Skill) => {
    setSkills((prev) =>
      prev.map((skill) => (skill.id === updatedSkill.id ? updatedSkill : skill))
    );
    upsertSkillCache(campaignKey, updatedSkill);
    setIsFormOpen(false);
    setEditingSkill(null);
  };

  const handleDeleted = (skillId: number) => {
    setSkills((prev) => prev.filter((skill) => skill.id !== skillId));
    removeSkillCache(campaignKey, skillId);
    setIsFormOpen(false);
    setEditingSkill(null);
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setIsFormOpen(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
      <div className="h-full flex flex-col gap-6 overflow-hidden">
        <PageHeader title="Skills" subtitle="Combat disciplines and abilities" />

      <CardBackground className="flex min-h-0 flex-1 flex-col gap-4 p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="max-w-sm">
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
            {canAdd && !isFormOpen ? (
              <Button size="sm" onClick={() => setIsFormOpen(true)}>
                Add skill
              </Button>
            ) : null}
          </div>
        </div>
        {isFormOpen && (
          <div ref={formRef}>
            <AddSkillForm
              campaignId={Number(id)}
              onCreated={handleCreated}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              onCancel={() => { setIsFormOpen(false); setEditingSkill(null); }}
              typeOptions={typeOptions}
              editingSkill={editingSkill}
            />
          </div>
        )}
        <div className="flex flex-1 min-h-0 flex-col">
          {isLoading ? (
            <TableSkeleton columns={4} rows={12} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filteredSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills logged yet.</p>
          ) : (
            <SkillsTable
              skills={filteredSkills}
              rowBackground={SKILL_ROW_BG_STYLE}
              renderActions={(skill) => (
                <div className="flex items-center justify-end gap-2">
                  <LearnSkillDialog skill={skill} unitTypes={["heroes", "hiredswords"]} />
                  {skill.campaign_id ? (
                    <Tooltip
                      trigger={
                        <button
                          type="button"
                          aria-label="Edit skill"
                          onClick={() => handleEdit(skill)}
                          className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
                        >
                          <img src={editIcon} alt="" className="h-full w-full object-contain" />
                        </button>
                      }
                      content="Edit"
                    />
                  ) : null}
                </div>
              )}
            />
          )}
        </div>
      </CardBackground>
    </div>
  );
}
