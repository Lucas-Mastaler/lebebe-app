"use client";

import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { IconButton, Input } from "@/components/design-system";

interface Props {
  contactId: string;
  valor: string;
  onSalvar: (contactId: string, observacao: string) => Promise<void>;
}

export function CelulaObservacao({ contactId, valor, onSalvar }: Props) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTexto(valor);
  }, [valor]);

  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editando]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(contactId, texto.trim());
      setEditando(false);
    } catch (e) {
      console.error("Erro ao salvar observação:", e);
    } finally {
      setSalvando(false);
    }
  };

  const handleCancelar = () => {
    setTexto(valor);
    setEditando(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSalvar();
    if (e.key === "Escape") handleCancelar();
  };

  if (!editando) {
    return (
      <div
        className="flex items-center gap-1 cursor-pointer group min-w-[160px] max-w-[220px]"
        onClick={() => setEditando(true)}
        title="Clique para editar"
      >
        <span className="text-sm text-slate-600 truncate flex-1">
          {valor || <span className="text-slate-400 italic">Sem obs.</span>}
        </span>
        <Pencil className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-[160px] max-w-[220px]">
      <Input
        ref={inputRef}
        type="text"
        maxLength={100}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={salvando}
        className="h-8 flex-1 min-w-0"
        placeholder="Observação..."
      />
      <IconButton
        aria-label="Salvar observação"
        variant="ghost"
        size="sm"
        onClick={handleSalvar}
        disabled={salvando}
        className="shrink-0 text-success hover:bg-success/10"
      >
        <Check className="size-4" />
      </IconButton>
      <IconButton
        aria-label="Cancelar edição"
        variant="ghost"
        size="sm"
        onClick={handleCancelar}
        disabled={salvando}
        className="shrink-0 text-destructive hover:bg-destructive/10"
      >
        <X className="size-4" />
      </IconButton>
    </div>
  );
}
