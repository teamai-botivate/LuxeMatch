/**
 * Seed demo e-commerce data (branches, customers, addresses, orders) into the
 * live Supabase project. Despite the name, this does NOT apply migrations —
 * apply 0002_ecommerce.sql via the Supabase dashboard SQL editor first.
 *
 * Credentials are loaded from the environment (NOT hardcoded). Run via:
 *   pnpm seed:ecommerce
 * which loads apps/web/.env.local through `tsx --env-file`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run via `pnpm seed:ecommerce` so apps/web/.env.local is loaded.',
  );
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function rpc(fn, params = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers,
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(`rpc/${fn} failed ${r.status}: ${await r.text()}`);
  return r.json();
}

async function insert(table, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers,
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const t = await r.text();
    if (t.includes('duplicate key') || t.includes('already exists')) {
      console.log(`  skip ${table} (already exists)`);
      return;
    }
    throw new Error(`insert ${table} failed ${r.status}: ${t}`);
  }
  return r.json();
}

// ── 1. Bootstrap: create exec_sql helper via Supabase's built-in pg_catalog ──
// Supabase service_role can create schemas and functions via PostgREST if
// the target is a user-defined function in public schema.
// We use a clever trick: insert into a table that has a BEFORE INSERT trigger
// that runs DDL … but since we don't have that, we use the GraphQL endpoint
// which may have elevated privileges. If that fails, we fall back to printing
// the SQL for manual execution.

async function tryCreateExecFn() {
  // Attempt via GraphQL mutation (Supabase exposes /graphql/v1)
  const gql = `mutation { query: exec_sql(sql: "SELECT 1") { result } }`;
  const r = await fetch(`${SUPABASE_URL}/graphql/v1`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql }),
  });
  return r.status !== 404;
}

// ── Fallback: print SQL for manual run ───────────────────────────────────────
function printSqlInstructions(sql) {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  ACTION REQUIRED: Run migration in Supabase dashboard  ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  1. Go to: https://supabase.com/dashboard              ║');
  console.log('║  2. Open your project → SQL Editor                     ║');
  console.log('║  3. Paste the content of:                              ║');
  console.log('║     supabase/migrations/0002_ecommerce.sql             ║');
  console.log('║  4. Click Run                                           ║');
  console.log('║  5. Then re-run:  node scripts/run-migration.mjs       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
}

// ── 2. Seed branches ─────────────────────────────────────────────────────────
const JEWELLER_ID = '00000000-0000-0000-0000-00000000d3e1';

const BRANCHES = [
  {
    jeweller_id: JEWELLER_ID,
    name: 'AT Jewellers – Connaught Place',
    city: 'New Delhi',
    address: 'F-12, Connaught Place, New Delhi – 110001',
    pin_code: '110001',
    phone: '+91-11-4321-0000',
    email: 'cp@atjewellers.in',
    lat: 28.6315, lng: 77.2167,
  },
  {
    jeweller_id: JEWELLER_ID,
    name: 'AT Jewellers – Bandra West',
    city: 'Mumbai',
    address: 'Shop 3, Linking Road, Bandra West, Mumbai – 400050',
    pin_code: '400050',
    phone: '+91-22-2640-0000',
    email: 'bandra@atjewellers.in',
    lat: 19.0596, lng: 72.8295,
  },
  {
    jeweller_id: JEWELLER_ID,
    name: 'AT Jewellers – MI Road',
    city: 'Jaipur',
    address: '14, MI Road, Jaipur – 302001',
    pin_code: '302001',
    phone: '+91-141-2370-000',
    email: 'jaipur@atjewellers.in',
    lat: 26.9124, lng: 75.7873,
  },
  {
    jeweller_id: JEWELLER_ID,
    name: 'AT Jewellers – Anna Nagar',
    city: 'Chennai',
    address: '23 2nd Avenue, Anna Nagar, Chennai – 600040',
    pin_code: '600040',
    phone: '+91-44-2626-0000',
    email: 'chennai@atjewellers.in',
    lat: 13.0850, lng: 80.2101,
  },
];

// ── 3. Seed demo customers ────────────────────────────────────────────────────
const DEMO_CUSTOMERS = [
  { jeweller_id: JEWELLER_ID, phone: '+919876543210', name: 'Priya Sharma' },
  { jeweller_id: JEWELLER_ID, phone: '+919876543211', name: 'Anjali Mehta' },
  { jeweller_id: JEWELLER_ID, phone: '+919876543212', name: 'Kavita Singh' },
];

async function main() {
  console.log('\n🏗  AT Jewellers — E-commerce Migration & Seed\n');

  // Check if branches table exists
  const check = await fetch(`${SUPABASE_URL}/rest/v1/branches?limit=1`, { headers });
  if (!check.ok) {
    console.log('❌ branches table not found. Please run the migration SQL first.\n');
    printSqlInstructions();
    process.exit(1);
  }

  console.log('✅ branches table exists');

  // Seed branches
  console.log('\n📍 Seeding branches...');
  for (const branch of BRANCHES) {
    try {
      await insert('branches', branch);
      console.log(`  ✓ ${branch.name}`);
    } catch (e) {
      console.log(`  ! ${branch.name}: ${e.message.slice(0, 80)}`);
    }
  }

  // Seed demo customers
  console.log('\n👥 Seeding demo customers...');
  const customerIds = [];
  for (const cust of DEMO_CUSTOMERS) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(cust),
      });
      if (r.ok) {
        const [row] = await r.json();
        customerIds.push({ id: row.id, ...cust });
        console.log(`  ✓ ${cust.name} (${cust.phone})`);
      } else {
        const t = await r.text();
        if (t.includes('duplicate key')) {
          // Fetch existing
          const ex = await fetch(`${SUPABASE_URL}/rest/v1/customers?jeweller_id=eq.${JEWELLER_ID}&phone=eq.${encodeURIComponent(cust.phone)}&select=id`, { headers });
          const [row] = await ex.json();
          if (row) customerIds.push({ id: row.id, ...cust });
          console.log(`  skip ${cust.name} (already exists)`);
        } else {
          console.log(`  ! ${cust.name}: ${t.slice(0, 80)}`);
        }
      }
    } catch (e) {
      console.log(`  ! ${cust.name}: ${e.message.slice(0, 80)}`);
    }
  }

  // Seed demo addresses
  if (customerIds.length > 0) {
    console.log('\n📬 Seeding demo addresses...');
    const addr = {
      customer_id: customerIds[0].id,
      label: 'Home', name: 'Priya Sharma', phone: '+919876543210',
      line1: '42 Green Park Extension', city: 'New Delhi',
      state: 'Delhi', pin_code: '110016', is_default: true,
    };
    try {
      await insert('customer_addresses', addr);
      console.log(`  ✓ Address for ${customerIds[0].name}`);
    } catch (e) {
      console.log(`  ! Address: ${e.message.slice(0, 80)}`);
    }
  }

  // Seed demo orders
  console.log('\n🛍  Seeding demo orders...');
  if (customerIds.length > 0) {
    // Fetch a couple of product IDs to use
    const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/products?jeweller_id=eq.${JEWELLER_ID}&is_active=eq.true&select=id,name,slug,price_min,price_max&limit=3`, { headers });
    const products = await prodRes.json();

    if (products.length > 0) {
      const branchRes = await fetch(`${SUPABASE_URL}/rest/v1/branches?jeweller_id=eq.${JEWELLER_ID}&select=id&limit=1`, { headers });
      const [branch] = await branchRes.json();

      const demoOrders = [
        {
          jeweller_id: JEWELLER_ID,
          customer_id: customerIds[0]?.id,
          branch_id: branch?.id,
          order_number: 'ATJ-20260525-A1B2',
          status: 'delivered',
          delivery_type: 'delivery',
          subtotal: products[0].price_min ?? 85000,
          discount: 0,
          total: products[0].price_min ?? 85000,
          payment_method: 'dummy_upi',
          payment_status: 'paid',
          payment_id: 'DUMMY_PAY_001',
          shipping_name: 'Priya Sharma',
          shipping_phone: '+919876543210',
          shipping_line1: '42 Green Park Extension',
          shipping_city: 'New Delhi',
          shipping_state: 'Delhi',
          shipping_pin_code: '110016',
          estimated_delivery: '2026-05-28',
        },
        {
          jeweller_id: JEWELLER_ID,
          customer_id: customerIds[0]?.id,
          branch_id: branch?.id,
          order_number: 'ATJ-20260527-C3D4',
          status: 'shipped',
          delivery_type: 'delivery',
          subtotal: products[1]?.price_min ?? 65000,
          discount: 2000,
          total: (products[1]?.price_min ?? 65000) - 2000,
          payment_method: 'dummy_card',
          payment_status: 'paid',
          payment_id: 'DUMMY_PAY_002',
          shipping_name: 'Priya Sharma',
          shipping_phone: '+919876543210',
          shipping_line1: '42 Green Park Extension',
          shipping_city: 'New Delhi',
          shipping_state: 'Delhi',
          shipping_pin_code: '110016',
          estimated_delivery: '2026-05-31',
        },
      ];

      for (const order of demoOrders) {
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=representation' },
            body: JSON.stringify(order),
          });
          if (r.ok) {
            const [row] = await r.json();

            // Add order items
            const prod = products[demoOrders.indexOf(order)] ?? products[0];
            await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
              method: 'POST', headers,
              body: JSON.stringify({
                order_id: row.id,
                product_id: prod.id,
                product_name: prod.name,
                product_slug: prod.slug,
                quantity: 1,
                unit_price: prod.price_min ?? 85000,
                total_price: prod.price_min ?? 85000,
              }),
            });

            // Add status history
            const statusHistory = order.status === 'delivered'
              ? ['placed', 'confirmed', 'packed', 'shipped', 'delivered']
              : ['placed', 'confirmed', 'packed', 'shipped'];

            for (let i = 0; i < statusHistory.length; i++) {
              const st = statusHistory[i];
              const notes = {
                placed: 'Order placed successfully.',
                confirmed: 'Order confirmed by AT Jewellers.',
                packed: 'Your jewellery has been carefully packed.',
                shipped: 'Out for delivery with courier partner.',
                delivered: 'Delivered. Enjoy your jewellery!',
              };
              await fetch(`${SUPABASE_URL}/rest/v1/order_status_history`, {
                method: 'POST', headers,
                body: JSON.stringify({
                  order_id: row.id,
                  status: st,
                  note: notes[st],
                  created_at: new Date(Date.now() - (statusHistory.length - i) * 8 * 3600 * 1000).toISOString(),
                }),
              });
            }

            console.log(`  ✓ Order ${order.order_number} (${order.status})`);
          } else {
            const t = await r.text();
            if (t.includes('duplicate key')) console.log(`  skip ${order.order_number} (exists)`);
            else console.log(`  ! ${order.order_number}: ${t.slice(0,80)}`);
          }
        } catch (e) {
          console.log(`  ! Order: ${e.message.slice(0, 80)}`);
        }
      }
    }
  }

  console.log('\n✅ Migration & seed complete!\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
