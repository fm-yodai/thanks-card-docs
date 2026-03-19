---
name: vue3-shadcn-tailwind
description: >-
  Vue 3 (Composition API / script setup) + shadcn-vue + Tailwind CSS development guide.
  Provides component patterns, shadcn-vue usage and customization, Tailwind CSS utilities,
  theming with CSS variables, cn() utility, and Reka UI primitives.
  Use this skill whenever working on Vue SFC (.vue) files, adding or modifying UI components,
  styling with Tailwind, building forms, dialogs, layouts, or any frontend work involving
  Vue 3, shadcn-vue, or Tailwind CSS — even if the user doesn't explicitly name these technologies.
  Also use when the user asks about component libraries, UI patterns, or responsive design in a Vue project.
---

# Vue 3 + shadcn-vue + Tailwind CSS

## Vue 3 Composition API

Always use `<script setup lang="ts">` syntax. This is the recommended and most concise way to write Vue 3 components.

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// Props with TypeScript
interface Props {
  title: string
  count?: number
}
const props = withDefaults(defineProps<Props>(), {
  count: 0,
})

// Emits with TypeScript
const emit = defineEmits<{
  update: [value: string]
  delete: [id: string]
}>()

// Reactive state
const isOpen = ref(false)
const doubled = computed(() => props.count * 2)

// Lifecycle
onMounted(() => {
  // initialization
})
</script>
```

### Key patterns

- **v-model**: Use `defineModel()` for two-way binding (Vue 3.4+):
  ```vue
  <script setup lang="ts">
  const modelValue = defineModel<string>({ required: true })
  </script>
  ```
- **Template refs**: Use `useTemplateRef()` (Vue 3.5+) or `ref<HTMLElement | null>(null)`.
- **Provide / Inject**: Use typed `InjectionKey<T>` for type-safe dependency injection.
- **v-html is prohibited**: Always use `{{ }}` interpolation for XSS prevention. Never use `v-html`.

### Composables

Composables are the primary pattern for reusable stateful logic. Prefix with `use`.

```typescript
// composables/useToggle.ts
import { ref } from 'vue'

export function useToggle(initial = false) {
  const value = ref(initial)
  const toggle = () => { value.value = !value.value }
  return { value, toggle }
}
```

## shadcn-vue

shadcn-vue is a Vue port of shadcn/ui. Components are **copied into your project** (not installed as a dependency), giving full ownership and customization control.

### Important: shadcn-vue is NOT shadcn/ui (React)

| Aspect | shadcn/ui (React) | shadcn-vue (Vue) |
|--------|-------------------|------------------|
| Primitives | Radix UI | **Reka UI** (formerly Radix Vue) |
| State binding | `open={open}` | `v-model:open="open"` |
| Render delegation | `asChild` | `as-child` (kebab-case) |
| Event handling | `onClick` | `@click` |
| Conditional render | `{condition && <X/>}` | `v-if="condition"` |

Never generate React-style shadcn/ui code. Always use Vue-specific patterns.

### CLI commands

```bash
# Initialize shadcn-vue in a project
npx shadcn-vue@latest init

# Add a component (copies source files into your project)
npx shadcn-vue@latest add button
npx shadcn-vue@latest add dialog card input label

# Add multiple components at once
npx shadcn-vue@latest add button input label textarea select

# Show project configuration
npx shadcn-vue@latest info
```

### Component import pattern

Components are always imported from `@/components/ui/<component-name>`:

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
</script>
```

### The `cn()` utility

Used to merge Tailwind classes with conflict resolution. Located at `@/lib/utils`:

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Use `cn()` when building components that accept a `class` prop:

```vue
<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('rounded-lg border p-4', props.class)">
    <slot />
  </div>
</template>
```

### Common component usage patterns

**Button variants:**
```vue
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="link">Link</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><IconComponent /></Button>
```

**Dialog (modal) with v-model:**
```vue
<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline">Open</Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description text.</DialogDescription>
      </DialogHeader>
      <!-- content -->
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button @click="handleSave">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

**Form with Input and Label:**
```vue
<div class="grid gap-4">
  <div class="grid gap-2">
    <Label for="email">Email</Label>
    <Input id="email" v-model="email" type="email" placeholder="you@example.com" />
  </div>
  <div class="grid gap-2">
    <Label for="message">Message</Label>
    <Textarea id="message" v-model="message" placeholder="Write something..." />
  </div>
</div>
```

**Badge:**
```vue
<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Destructive</Badge>
```

For the full list of available components, import paths, and detailed usage, see [references/shadcn-vue-components.md](references/shadcn-vue-components.md).

### Customizing components

Since components are copied into your project, customize them directly:

1. **Style changes**: Modify Tailwind classes in the component source
2. **Behavior changes**: Edit the component logic directly
3. **New variants**: Add to the `cva()` variants definition in the component

```typescript
// Example: adding a variant to button
const buttonVariants = cva(
  'inline-flex items-center justify-center ...',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground ...',
        // Add custom variant
        success: 'bg-green-600 text-white hover:bg-green-700',
      },
    },
  },
)
```

## Tailwind CSS

### Theming with CSS variables

shadcn-vue uses CSS variables for theming. Colors are defined in oklch format:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}
```

Use semantic color names in Tailwind classes:
```html
<!-- Do: Use semantic tokens -->
<div class="bg-background text-foreground border-border">
<p class="text-muted-foreground">
<button class="bg-primary text-primary-foreground">

<!-- Don't: Use raw colors when semantic tokens exist -->
<div class="bg-white text-black border-gray-200">
```

### Responsive design

Mobile-first breakpoints:
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
<div class="p-4 sm:p-6 lg:p-8">
<div class="hidden md:block">
```

### Common layout patterns

**Card grid:**
```html
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <!-- Card items -->
</div>
```

**Centered content with max-width:**
```html
<div class="mx-auto w-full max-w-2xl px-4">
  <!-- Content -->
</div>
```

**Flex with gap:**
```html
<div class="flex items-center gap-2">
  <Icon />
  <span>Text</span>
</div>
```

**Stack (vertical spacing):**
```html
<div class="flex flex-col gap-4">
  <!-- Stacked items -->
</div>
<!-- or -->
<div class="space-y-4">
  <!-- Stacked items -->
</div>
```

### Dark mode

shadcn-vue uses class-based dark mode. Toggle the `dark` class on `<html>`:

```typescript
// Toggle dark mode
document.documentElement.classList.toggle('dark')
```

Dark-mode styles use the `dark:` variant:
```html
<div class="bg-white dark:bg-slate-900">
```

When using shadcn-vue's CSS variable system, dark mode colors are automatically applied through the `.dark` selector — no `dark:` prefix needed for theme colors.

## Common mistakes to avoid

1. **Using Radix Vue imports** — shadcn-vue now uses Reka UI. Import from `reka-ui`, not `radix-vue`.
2. **React-style JSX patterns** — Use `v-model:open`, `as-child`, `@click`, not React equivalents.
3. **Using `v-html`** — Prohibited for XSS prevention. Use `{{ }}` interpolation.
4. **Hardcoded colors** — Use semantic CSS variable tokens (`bg-primary`, not `bg-blue-600`).
5. **Missing `cn()` in custom components** — Always use `cn()` when accepting a `class` prop to allow overrides.
6. **Importing from package** — shadcn-vue components are local files (`@/components/ui/`), not npm imports.
