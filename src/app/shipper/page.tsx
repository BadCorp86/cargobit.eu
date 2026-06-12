import { redirect } from 'next/navigation';

export default function ShipperIndexPage() {
  redirect('/dashboard?role=shipper');
}
