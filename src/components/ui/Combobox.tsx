"use client"

import * as React from "react"
import { Plus, Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/Command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onChange: (value: string) => void
  allowCustomValue?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No option found.",
  allowCustomValue = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-12 w-full justify-between rounded-xl border-black/5 dark:border-white/10 bg-secondary/40 dark:bg-white/5 font-normal",
            className
          )}
        >
          {value
            ? options.find((option) => option.value === value)?.label || value
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-[1100]">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustomValue && searchValue ? (
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-primary"
                    onClick={() => {
                      onChange(searchValue)
                      setOpen(false)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Use "{searchValue}"
                  </Button>
                </div>
              ) : (
                emptyMessage
              )}
            </CommandEmpty>
            <CommandGroup>
              {allowCustomValue && searchValue && !options.some(opt => opt.label.toLowerCase() === searchValue.toLowerCase()) && (
                <CommandItem
                  value={searchValue}
                  onSelect={(val) => {
                    onChange(val)
                    setOpen(false)
                  }}
                  className="text-primary font-medium"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Use "{searchValue}"
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
