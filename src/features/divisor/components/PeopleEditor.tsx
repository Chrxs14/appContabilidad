import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  people: string[]
  onChange: (people: string[]) => void
}

export function PeopleEditor({ people, onChange }: Props) {
  const [input, setInput] = useState('')

  function add() {
    const name = input.trim()
    if (!name) return
    const exists = people.some((p) => p.toLowerCase() === name.toLowerCase())
    if (exists) return
    onChange([...people, name])
    setInput('')
  }

  function remove(index: number) {
    onChange(people.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Nombre de la persona"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!input.trim()}>
          + Agregar
        </Button>
      </div>

      {people.length > 0 && (
        <ul className="space-y-1.5">
          {people.map((name, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
            >
              <span>{name}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Eliminar ${name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {people.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Agrega al menos 2 personas para dividir la cuenta.
        </p>
      )}
    </div>
  )
}
