'use client'

import { LogOut, ChevronDown } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logout } from '@/app/(backoffice)/actions'

interface TopbarProps {
  userName: string
  userEmail: string
  userRole: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function Topbar({ userName, userEmail, userRole }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      {/* Left — reserved for breadcrumbs (added in CAM-10 follow-ups) */}
      <div />

      {/* Right — user menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted focus:outline-none">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{userRole}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium">{userName}</p>
            <p className="text-[11px] text-muted-foreground">{userEmail}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onSelect={() => logout()}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
