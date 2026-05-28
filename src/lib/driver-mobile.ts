import { getFallbackDriverMission } from '@/lib/product-operating-model';

export type DriverMobileActionId =
  | 'confirm_pickup'
  | 'send_status'
  | 'confirm_delivery'
  | 'submit_pod'
  | 'upload_photo'
  | 'contact_support';

export interface DriverMobileActionInput {
  action: DriverMobileActionId;
  missionId?: string;
  transportId?: string;
  userId?: string | null;
  note?: string;
  podUrl?: string;
  photoUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
  };
}

export function buildDriverMissionFromAssignment(assignment: any, driver: any) {
  const transport = assignment.transport;
  const pickupDone = ['PICKUP_DONE', 'IN_TRANSIT', 'DELIVERY_DONE', 'COMPLETED'].includes(transport.status);
  const delivered = ['DELIVERY_DONE', 'COMPLETED'].includes(transport.status);
  const completed = transport.status === 'COMPLETED';
  const podDone = transport.documents?.some((document: any) => ['pod', 'foto_delivery'].includes(document.type)) || completed;
  const progressByStatus: Record<string, number> = {
    ASSIGNED: 18,
    PICKUP_DONE: 42,
    IN_TRANSIT: 68,
    DELIVERY_DONE: 86,
    COMPLETED: 100,
  };
  const pickupCity = transport.pickupAddress?.city || 'Abholung';
  const deliveryCity = transport.deliveryAddress?.city || 'Lieferung';

  return {
    id: transport.id,
    title: `${pickupCity} → ${deliveryCity}`,
    subtitle: `${transport.description || 'Transportauftrag'} · ${transport.agreedPrice || transport.shipperBudget || 0} ${transport.currency}`,
    status: transport.status,
    payout: `${transport.agreedPrice || transport.shipperBudget || 0} ${transport.currency}`,
    progress: progressByStatus[transport.status] || 20,
    driver: {
      id: driver.id,
      rating: driver.ratingAvg,
      completedTransports: driver.completedTransports,
      licenseClass: driver.licenseClass,
    },
    vehicle: {
      id: assignment.vehicleId,
      label: assignment.vehicle?.licensePlate || assignment.vehicle?.type || 'Fahrzeug',
    },
    nextStop: {
      label: completed ? 'Payout Gate' : delivered ? deliveryCity : pickupDone ? 'Naechster Checkpoint' : pickupCity,
      eta: transport.deliveryDatetime
        ? new Date(transport.deliveryDatetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : 'Heute',
      action: completed ? 'Auszahlung pruefen' : delivered ? 'POD erfassen' : pickupDone ? 'Status unterwegs senden' : 'Abholung bestaetigen',
    },
    checklist: [
      { id: 'accepted', label: 'Auftrag angenommen', done: true },
      { id: 'pickup', label: 'Abholung bestaetigt', done: pickupDone },
      { id: 'location', label: 'Live-Status aktiv', done: ['IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE', 'COMPLETED'].includes(transport.status) },
      { id: 'delivery', label: 'Lieferung bestaetigt', done: delivered || completed },
      { id: 'pod', label: 'POD Foto/Signatur erfasst', done: podDone },
    ],
    actions: [
      { label: pickupDone ? 'Status senden' : 'Abholung bestaetigen', href: `/api/driver/mobile/action` },
      { label: 'POD hochladen', href: `/api/driver/mobile/action` },
      { label: 'Support', href: '/support/tickets' },
    ],
  };
}

export function getStatusForDriverAction(action: DriverMobileActionId, currentStatus?: string | null) {
  const status = (currentStatus || '').toUpperCase();

  switch (action) {
    case 'confirm_pickup':
      return 'PICKUP_DONE';
    case 'send_status':
      return status === 'ASSIGNED' ? 'IN_TRANSIT' : status || 'IN_TRANSIT';
    case 'confirm_delivery':
      return 'DELIVERY_DONE';
    case 'submit_pod':
      return 'COMPLETED';
    case 'upload_photo':
    case 'contact_support':
    default:
      return status || 'IN_TRANSIT';
  }
}

export function getDriverActionMessage(action: DriverMobileActionId) {
  switch (action) {
    case 'confirm_pickup':
      return 'Abholung wurde bestaetigt. Der Auftrag ist jetzt in der mobilen Timeline aktualisiert.';
    case 'send_status':
      return 'Live-Status wurde gesendet. Disposition und Verlader sehen den aktuellen Stand.';
    case 'confirm_delivery':
      return 'Lieferung wurde bestaetigt. Als naechstes wird der POD erfasst.';
    case 'submit_pod':
      return 'POD wurde gespeichert. Rechnung und Auszahlung koennen vorbereitet werden.';
    case 'upload_photo':
      return 'Foto wurde gespeichert und an den Auftrag angehaengt.';
    case 'contact_support':
      return 'Support-Kontext wurde vorbereitet.';
    default:
      return 'Aktion wurde verarbeitet.';
  }
}

export function applyDemoDriverAction(action: DriverMobileActionId) {
  const mission = getFallbackDriverMission();

  if (action === 'confirm_delivery') {
    return {
      ...mission,
      status: 'DELIVERY_DONE',
      progress: 86,
      nextStop: {
        label: 'Muenchen',
        eta: 'Jetzt',
        action: 'POD erfassen',
      },
      checklist: mission.checklist.map((item) =>
        item.id === 'delivery' ? { ...item, done: true } : item,
      ),
    };
  }

  if (action === 'submit_pod' || action === 'upload_photo') {
    return {
      ...mission,
      status: 'COMPLETED',
      progress: 100,
      nextStop: {
        label: 'Payout Gate',
        eta: '2-24 Std.',
        action: 'Auszahlung pruefen',
      },
      checklist: mission.checklist.map((item) =>
        ['delivery', 'pod'].includes(item.id) ? { ...item, done: true } : item,
      ),
    };
  }

  if (action === 'confirm_pickup' || action === 'send_status') {
    return {
      ...mission,
      status: 'IN_TRANSIT',
      progress: 72,
      checklist: mission.checklist.map((item) =>
        ['pickup', 'location'].includes(item.id) ? { ...item, done: true } : item,
      ),
    };
  }

  return mission;
}
