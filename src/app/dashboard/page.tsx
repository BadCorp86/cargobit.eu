import { RoleDashboardClient } from '@/components/dashboard/role-dashboard-client';
import { type DashboardRole, normalizeDashboardRole } from '@/lib/role-dashboard-data';

type PreviewDashboardUser = {
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string;
  role: string;
  accountType?: string;
  organizationRole?: string;
};

const previewUsers: Record<DashboardRole, PreviewDashboardUser> = {
  shipper: {
    firstName: 'Max',
    lastName: 'Müller',
    email: 'shipper@cargobit.eu',
    companyName: 'Müller Logistics GmbH',
    role: 'SHIPPER_COMPANY',
    accountType: 'SHIPPER',
    organizationRole: 'OWNER',
  },
  carrier: {
    firstName: 'Anna',
    lastName: 'Schmidt',
    email: 'carrier@cargobit.eu',
    companyName: 'Schmidt Spedition',
    role: 'CARRIER',
    accountType: 'CARRIER_COMPANY',
    organizationRole: 'OWNER',
  },
  driver: {
    firstName: 'Thomas',
    lastName: 'Weber',
    email: 'driver@cargobit.eu',
    role: 'DRIVER_SELF_EMPLOYED',
    accountType: 'TRANSPORT_SOLO',
    organizationRole: 'OWNER_DRIVER',
  },
  dispatcher: {
    firstName: 'Anna',
    lastName: 'Schmidt',
    email: 'dispatcher@cargobit.eu',
    companyName: 'Schmidt Spedition',
    role: 'DISPATCHER',
    accountType: 'CARRIER_COMPANY',
    organizationRole: 'DISPATCHER',
  },
  support: {
    firstName: 'Lisa',
    lastName: 'Support',
    email: 'support@cargobit.eu',
    role: 'SUPPORT',
    accountType: 'INTERNAL',
    organizationRole: 'SUPPORT',
  },
  marketer: {
    firstName: 'Peter',
    lastName: 'Marketing',
    email: 'marketer@cargobit.eu',
    role: 'MARKETER',
    accountType: 'INTERNAL',
    organizationRole: 'MARKETING',
  },
};

const explicitPreviewUsers: Record<string, PreviewDashboardUser> = {
  SHIPPER_COMPANY: previewUsers.shipper,
  shipper_company: previewUsers.shipper,
  SHIPPER_PRIVATE: {
    firstName: 'Laura',
    lastName: 'Becker',
    email: 'shipper.private@cargobit.eu',
    role: 'SHIPPER_PRIVATE',
    accountType: 'SHIPPER',
    organizationRole: 'MEMBER',
  },
  shipper_private: {
    firstName: 'Laura',
    lastName: 'Becker',
    email: 'shipper.private@cargobit.eu',
    role: 'SHIPPER_PRIVATE',
    accountType: 'SHIPPER',
    organizationRole: 'MEMBER',
  },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string }> | { role?: string };
}) {
  const params = searchParams ? await searchParams : undefined;
  const roleParam = params?.role;
  const role = normalizeDashboardRole(roleParam);
  const user = roleParam ? explicitPreviewUsers[roleParam] || previewUsers[role] : previewUsers[role];

  return (
    <RoleDashboardClient
      roleOverride={role}
      fallbackUser={user}
    />
  );
}
