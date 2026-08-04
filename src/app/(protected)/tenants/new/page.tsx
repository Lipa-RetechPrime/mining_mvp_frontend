'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/shared/components/ui/Button'
import { IconField } from '@/shared/components/ui/IconField'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { useRouter } from 'next/navigation'
import { routes } from '@/shared/config/routes'

export type TenantRegistrationFormProps = {
  /** Where Cancel navigates. */
  cancelTo?: string
  /** Where to go after a successful register. */
  successTo?: string
  /** Optional className on the form wrapper. */
  className?: string
  /** Show the circular header icon + title block. Defaults to true. */
  showHeader?: boolean
}

/** Tenant registration fields — usable on the public page or inside AppShell. */
export default function TenantRegistrationForm({
  cancelTo = routes.tenants.list,
  successTo = routes.tenants.list,
  className = '',
  showHeader = true,
}: TenantRegistrationFormProps) {
  const router = useRouter()
  const [tenantName, setTenantName] = useState('')
  const [address, setAddress] = useState('')
  const [mobile, setMobile] = useState('')
  const [activeTill, setActiveTill] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 400))
      router.push(routes.tenants.list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`w-full ${className} max-w-[1000px] mx-auto bg-white rounded-card px-6 py-8 sm:px-8`}>
      {showHeader ? (
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EDE9FE]">
            <MaterialIcon
              name="apartment"
              size={24}
              className="text-[--color-portal-purple]"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Tenant Registration
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#64748B]">
            Please provide the details below to register a new tenant in the system.
          </p>
        </div>
      ) : null}

      <form className="flex flex-col gap-5" onSubmit={(e) => void handleSubmit(e)}>
      <div className='flex gap-4'>
        <IconField
          id="tenantName"
          name="tenantName"
          label="Tenant Name"
          className='w-full'
          icon="person"
          placeholder="Enter tenant name"
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          autoComplete="organization"
          required
        />
        <IconField
            id="mobile"
            name="mobile"
            label="Mobile No."
            className='w-full'
            icon="call"
            type="tel"
            inputMode="numeric"
            placeholder="Enter mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 15))}
            autoComplete="tel"
            required
          />
        </div>
        <IconField
          id="address"
          name="address"
          label="Address"
          icon="location_on"
          as="textarea"
          placeholder="Enter complete address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
          required
        />
        <div className='flex gap-4'>
          
          <IconField
            id="activeTill"
            name="activeTill"
            label="Active Till"
            icon="calendar_month"
            type="date"
            placeholder="Select end date"
            value={activeTill}
            className='w-full'
            onChange={(e) => setActiveTill(e.target.value)}
            required
          />
          <IconField
            id="contactPerson"
            name="contactPerson"
            label="Contact Person"
            icon="person"
            type="text"
            placeholder="Enter contact person"
            value={contactPerson}
            className='w-full'
            onChange={(e) => setContactPerson(e.target.value)}
            required
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          variant="primary"
          type="submit"
          disabled={submitting}
          className="mt-1 !h-11 w-full !rounded-[6px] !bg-[--color-portal-navy] !text-base !font-semibold hover:!bg-[#141b26]"
        >
          {submitting ? 'Registering…' : 'Register Tenant'}
        </Button>

        <div className="text-center">
          <Link
            href={cancelTo}
            className="text-sm font-medium text-[#64748B] transition hover:text-[--color-portal-purple]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}



export function AddTenantPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-4">
      <div className="w-full max-w-[1000px] rounded-card bg-white px-6 py-8 sm:px-8">
        <TenantRegistrationForm
          cancelTo={routes.tenants.list}
          successTo={routes.tenants.list}
          showHeader
        />
      </div>
    </div>
  )
}
