# shadcn-vue Component Catalog

Complete list of available components with install commands and import patterns.
For detailed API of each component, use `npx shadcn-vue@latest info` or refer to https://www.shadcn-vue.com/docs/components/.

## Install

```bash
npx shadcn-vue@latest add <component-name>
```

## Component List

### Layout & Structure

| Component | Install | Description |
|-----------|---------|-------------|
| Card | `add card` | Container with header, content, footer sections |
| Separator | `add separator` | Visual divider between content |
| Collapsible | `add collapsible` | Expandable/collapsible content area |
| Accordion | `add accordion` | Vertically stacked collapsible sections |
| Tabs | `add tabs` | Tabbed content panels |
| Resizable | `add resizable` | Resizable panel groups |
| Scroll Area | `add scroll-area` | Custom scrollable container |
| Sidebar | `add sidebar` | Application sidebar with navigation |
| Aspect Ratio | `add aspect-ratio` | Fixed aspect ratio container |

### Forms & Input

| Component | Install | Description |
|-----------|---------|-------------|
| Button | `add button` | Clickable button with variants |
| Input | `add input` | Text input field |
| Textarea | `add textarea` | Multi-line text input |
| Label | `add label` | Form field label |
| Checkbox | `add checkbox` | Boolean toggle checkbox |
| Radio Group | `add radio-group` | Single selection from options |
| Switch | `add switch` | Toggle switch |
| Select | `add select` | Dropdown selection |
| Native Select | `add native-select` | Native HTML select element |
| Slider | `add slider` | Range value slider |
| Toggle | `add toggle` | Pressed/unpressed toggle button |
| Toggle Group | `add toggle-group` | Group of toggle buttons |
| Number Field | `add number-field` | Numeric input with increment/decrement |
| PIN Input | `add pin-input` | Code/PIN entry input |
| Date Picker | `add date-picker` | Date selection (uses Calendar) |
| Calendar | `add calendar` | Calendar date selector |
| Range Calendar | `add range-calendar` | Date range selector |

### Overlays & Popups

| Component | Install | Description |
|-----------|---------|-------------|
| Dialog | `add dialog` | Modal dialog window |
| Alert Dialog | `add alert-dialog` | Confirmation dialog (requires action) |
| Sheet | `add sheet` | Slide-out panel from screen edge |
| Drawer | `add drawer` | Mobile-friendly bottom drawer |
| Popover | `add popover` | Floating content on trigger |
| Tooltip | `add tooltip` | Hover information popup |
| Hover Card | `add hover-card` | Rich content on hover |
| Context Menu | `add context-menu` | Right-click menu |
| Dropdown Menu | `add dropdown-menu` | Button-triggered menu |
| Menubar | `add menubar` | Application menu bar |

### Feedback & Status

| Component | Install | Description |
|-----------|---------|-------------|
| Alert | `add alert` | Static alert message |
| Badge | `add badge` | Small label/tag |
| Toast | `add toast` | Temporary notification (uses Sonner) |
| Sonner | `add sonner` | Toast notification system |
| Progress | `add progress` | Progress indicator bar |
| Skeleton | `add skeleton` | Loading placeholder |

### Navigation

| Component | Install | Description |
|-----------|---------|-------------|
| Navigation Menu | `add navigation-menu` | Top-level navigation |
| Breadcrumb | `add breadcrumb` | Page hierarchy navigation |
| Pagination | `add pagination` | Page number navigation |
| Command | `add command` | Command palette / search |

### Data Display

| Component | Install | Description |
|-----------|---------|-------------|
| Table | `add table` | Data table |
| Avatar | `add avatar` | User avatar with fallback |
| Carousel | `add carousel` | Content carousel/slider |
| Chart | `add chart` | Data visualization charts |

### Utility

| Component | Install | Description |
|-----------|---------|-------------|
| Form | `add form` | Form validation (vee-validate + zod) |
| Auto Form | `add auto-form` | Auto-generated form from schema |
| Combobox | `add combobox` | Searchable select / autocomplete |
| Tags Input | `add tags-input` | Tag/chip input |

## Import Patterns

All components follow the same pattern:

```typescript
// Single component
import { Button } from '@/components/ui/button'

// Multiple sub-components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
```

### Components with sub-components

```typescript
// Dialog
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

// Select
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// Table
import {
  Table, TableBody, TableCaption, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// Dropdown Menu
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Tabs
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'

// Accordion
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'

// Alert Dialog
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// Sheet
import {
  Sheet, SheetClose, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'

// Toast (Sonner)
import { toast } from '@/components/ui/sonner'
// Usage: toast('Event created', { description: 'Monday, January 3rd' })
```

## Form Validation with vee-validate + Zod

```vue
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import {
  Form, FormControl, FormDescription,
  FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'

const formSchema = toTypedSchema(z.object({
  username: z.string().min(2).max(50),
}))

const { handleSubmit } = useForm({
  validationSchema: formSchema,
})

const onSubmit = handleSubmit((values) => {
  console.log(values)
})
</script>

<template>
  <form @submit="onSubmit">
    <FormField v-slot="{ componentField }" name="username">
      <FormItem>
        <FormLabel>Username</FormLabel>
        <FormControl>
          <Input placeholder="username" v-bind="componentField" />
        </FormControl>
        <FormDescription>Your public display name.</FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit">Submit</Button>
  </form>
</template>
```
