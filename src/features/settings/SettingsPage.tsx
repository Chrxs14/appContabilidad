import { useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { exportBackup, importBackup, type ImportMode } from '@/db'
import { useUIStore, type Theme } from '@/store/uiStore'

export function Component() {
  const { theme, setTheme, currency, locale } = useUIStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMode, setImportMode] = useState<ImportMode>('replace')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function handleExport() {
    try {
      await exportBackup()
      setStatus({ type: 'success', message: 'Respaldo exportado correctamente.' })
    } catch {
      setStatus({ type: 'error', message: 'Error al exportar el respaldo.' })
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importBackup(file, importMode)
      setStatus({ type: 'success', message: `Respaldo importado (modo: ${importMode}).` })
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al importar el respaldo.',
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const THEMES: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'system', label: 'Sistema' },
  ]

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configura la apariencia y gestiona tus datos.
        </p>
      </div>

      {/* Respaldo */}
      <Card>
        <CardHeader>
          <CardTitle>Respaldo de datos</CardTitle>
          <CardDescription>
            Tus datos se guardan localmente en el navegador. Exporta un respaldo regularmente para
            evitar pérdidas al limpiar el caché o cambiar de equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Exportar</p>
              <p className="text-muted-foreground text-xs">
                Descarga un archivo .json con todos tus datos.
              </p>
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              Exportar respaldo
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Importar</p>
              <p className="text-muted-foreground text-xs">
                Restaura datos desde un archivo de respaldo exportado anteriormente.
              </p>
            </div>

            <div className="flex gap-2">
              {(['replace', 'merge'] as ImportMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setImportMode(mode)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    importMode === mode
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {mode === 'replace' ? 'Reemplazar todo' : 'Fusionar'}
                </button>
              ))}
            </div>

            {importMode === 'replace' && (
              <p className="text-destructive text-xs">
                ⚠ Modo reemplazar: elimina todos los datos existentes antes de importar.
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
              Seleccionar archivo…
            </Button>
          </div>

          {status && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${
                status.type === 'success'
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {status.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Apariencia */}
      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>Elige el tema de color de la aplicación.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {THEMES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  theme === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Moneda */}
      <Card>
        <CardHeader>
          <CardTitle>Moneda</CardTitle>
          <CardDescription>
            Moneda activa para el formato de cantidades en toda la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {currency}
          </Badge>
          <span className="text-muted-foreground text-sm">{locale}</span>
          <span className="text-muted-foreground text-xs">(configurable en versiones futuras)</span>
        </CardContent>
      </Card>
    </div>
  )
}
