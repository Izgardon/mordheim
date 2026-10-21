import { useRef, useState } from "react";

/**
 * A catalogue page's Add / Edit form: whether it shows and which entry it edits (none when
 * adding). Edit scrolls the form into view.
 */
export function useCatalogueEditor<T>() {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  return {
    isOpen,
    editing,
    formRef,
    openNew: () => setIsOpen(true),
    edit: (entry: T) => {
      setEditing(entry);
      setIsOpen(true);
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    /** After a save, a delete or Cancel (the form wrote the cache itself). */
    close: () => {
      setIsOpen(false);
      setEditing(null);
    },
  };
}
