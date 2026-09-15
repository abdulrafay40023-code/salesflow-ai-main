import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORTED_COUNTRIES, getCountryByCode } from "@/lib/country-helper";
import { Check, ChevronsUpDown, Search } from "lucide-react";

export function CountryCombobox({
  value,
  onValueChange,
  className,
  includeAuto = false,
}: {
  value: string;
  onValueChange: (val: string) => void;
  className?: string;
  includeAuto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentCountry = value === "AUTO" ? null : getCountryByCode(value);

  const filteredCountries = SUPPORTED_COUNTRIES.filter((c) => {
    if (c.code === "UN") return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.toLowerCase().includes(q)
    );
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          size="sm"
          className={`h-7 justify-between rounded-lg border-border/60 bg-surface-2/60 px-2 text-xs font-medium ${className || "w-[135px]"}`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {value === "AUTO" ? (
              <>
                <span>🤖</span>
                <span className="truncate font-semibold text-violet-300">Auto-Detect</span>
              </>
            ) : currentCountry ? (
              <>
                <span className="text-sm leading-none">{currentCountry.flag}</span>
                <span className="truncate font-semibold text-foreground/90">{currentCountry.name}</span>
              </>
            ) : (
              <span>Select country...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2 rounded-xl bg-surface-1 border-border shadow-2xl z-50" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search (e.g. uk, pak, +1)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs rounded-lg bg-surface-2/80"
            autoFocus
          />
        </div>
        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
          {includeAuto && (
            <button
              type="button"
              onClick={() => {
                onValueChange("AUTO");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-violet-600/20 hover:text-violet-300 transition-colors ${
                value === "AUTO" ? "bg-violet-600/20 text-violet-300 font-bold" : "text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>🤖</span>
                <span>Smart Auto-Detect</span>
              </span>
              {value === "AUTO" && <Check className="size-3.5 text-violet-400" />}
            </button>
          )}

          {filteredCountries.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No matching country found.
            </div>
          ) : (
            filteredCountries.map((c) => {
              const isSelected = value.toUpperCase() === c.code.toUpperCase();
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onValueChange(c.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-violet-600/20 hover:text-violet-300 transition-colors ${
                    isSelected ? "bg-violet-600/20 text-violet-300 font-bold" : "text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-sm leading-none">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">({c.dialCode})</span>
                  </span>
                  {isSelected && <Check className="size-3.5 text-violet-400 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
