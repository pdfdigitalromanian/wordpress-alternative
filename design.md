# Digital Romanian CMS — designer wireframe brief

Repository: `pdfdigitalromanian/wordpress-alternative`

## Product and assignment

Design a modern, light, accessible website-building platform with optional Medusa-powered ecommerce. This is not merely a shop, an analytics dashboard, or a reskin of WordPress. The owner must be able to manage several sites, start from a genuinely blank canvas, build pages visually, manage content, publish safely, and operate an actual storefront.

Produce TWO clearly separated experiences: (1) the Digital Romanian administration and visual-editor interface; (2) a reusable example storefront and its complete customer journey. The administration has a stable product identity. Each published website has an independent, configurable theme. A storefront design must never become a compulsory theme for every new site.

The numbered requirements below describe the TARGET design, not a claim that every capability already exists. They combine the supplied original CMS specification and its Medusa extension with proposed interaction design. Validate implementation-dependent controls with the engineer. Do not interpret an attractive prototype as proof of backend support.

Initial commerce operations use native Medusa Admin. Design a clear handoff from the CMS, not an iframe, invented single sign-on, or a promise that native Medusa can simply inherit an entirely new interface. A later custom administration layer has its own wireframes below.

## Design batches

**P — Primary product design:** the builder, basic administration, product discovery, cart, guest checkout, and publishing. These are design priorities, not a claim that all should be implemented in one sprint.

**E — Expanded CMS:** the original content-management, advanced appearance, multilingual, integration and operational capabilities. Preserve them without making them blockers for the first purchase.

**F — Future unified commerce:** customer accounts and native-operation replacements inside the CMS. Design separately; do not insert dead links to them into the launch navigation.

First review the navigation model and these representative frames before expanding the entire inventory: 07, 11, 12, 17, 18, 24, 26, 33, 36, 39, 40, 42, 43 and 44. This catches interaction problems before they spread across dozens of screens. There are 80 numbered screen/state families below; overlays and variants should reuse their parent screen rather than become unrelated layouts.

## Visual direction

Use white content surfaces, a very pale neutral application background, dark readable text, subtle separators and one restrained interaction accent. Prefer an understated, precise interface over decorative gradients, glass effects, large shadows, oversized rounded cards or illustration-heavy empty states. Light must not mean low contrast. The editor canvas is visually distinct from the surrounding administration.

Use a consistent sans-serif family with complete Romanian and German character support. Start around 14–16 px for administration body copy and 16 px for storefront forms. Avoid tiny labels and ultra-light weights. Use a compact hierarchy, an 8 px spacing rhythm with smaller increments where useful, and approximately 8–12 px corner radii as starting design decisions, not compulsory brand rules. Give complex tables appropriate density; do not wrap every row or setting in its own large card.

Design at 1440 px desktop and 390 px phone. Check a 1280 px laptop, 768 px tablet and 320 CSS px narrow/reflow condition. The editor needs explicit adaptation, not a screenshot scaled down to fit. Suggested desktop shell: 232–248 px navigation, 56–64 px top bar; editor panels roughly 260 px left and 300–340 px right, resizable/collapsible. Let the canvas use the remaining space.

Use motion only to explain state or spatial relationships. Provide a reduced-motion variant. No Three.js effects in routine administration. An optional scene on a published page must not obstruct content or shopping controls.

## Information architecture and users

Keep workspace and site selection visible, but show only one current scope at a time. Proposed grouped navigation: Overview; Website (Pages, Templates, Appearance, Navigation, SEO); Content (Posts, Collections, Media, Forms); Store; Publishing; Settings. Workspace membership controls and site-specific settings must clearly identify their scope. Collapse secondary groups rather than displaying every page simultaneously.

Design for an owner managing several sites, an editor managing content, a separately authorized commerce operator, and a customer buying from one storefront. CMS roles are owner, administrator, editor and viewer. Commerce capabilities are separate: editing a page must not automatically imply access to orders, customer details, prices, inventory, refunds or credentials. Annotate which capability exposes each consequential action; the engineer must enforce it as well.

CMS staff authentication and storefront customer authentication are different experiences. Never send a shopper into the CMS login or an editor into a customer account page.

## Cross-screen interaction contract

Every frame must identify the user, scope, entry point, primary action, next destination, data source, permission, saving model and implementation batch. Show loading, empty, populated, validation, success, network failure, and permission-denied variants where applicable. Add session-expired, stale-data and partial-success variants for workflows that need them. These variants belong beside the successful screen, not in a separate forgotten appendix.

Use a single visually dominant action per task area. Reserve dialogs for short decisions; drawers for contextual editing; full pages for complex or consequential tasks. Avoid stacked dialogs. Preserve filters, scroll position and entered values when returning to a list or retrying a request. Confirm irreversible or broad-impact actions; use undo for safe reversible operations. Do not ask for confirmation on every ordinary save.

Show status in text as well as color. Distinguish: editing locally, saving, saved draft, unsaved changes, publishing, live, saved-but-not-published, conflict and failure. Do not call something successful before it is confirmed. A disabled action needs a visible reason and a recovery path. Do not expose raw API errors to shoppers.

Release/publish scope is site-wide unless the actual implementation changes. It can include other pages' drafts. Make this explicit. Publishing changes the CMS presentation; it does not publish Medusa products, revert live prices, alter stock, reverse orders or deploy application code.

For credentials, design masked values and replacement actions, never a stored-secret reveal pattern. For integrations, distinguish configuration saved, connection tested, functionality ready and last verified time. For payment state, distinguish order created, payment authorized, payment captured/received, and pending reconciliation.

### Accessibility contract

Target WCAG 2.2 AA for the implemented interface and generated defaults. Wireframes alone do not establish conformance. Annotate semantic landmarks, headings, labels, reading order, keyboard behavior and status announcements.

Normal text should meet 4.5:1 contrast and qualifying large text 3:1. Relevant non-text controls and state indicators need appropriate contrast too. Do not use placeholder text as the only label.

Use 44 × 44 CSS px as this project's preferred touch-target design target. WCAG 2.2 AA's target-size minimum is 24 × 24 CSS px, with defined exceptions; do not mislabel 44 px as the universal AA requirement.

Every drag interaction needs visible click/tap controls as well as keyboard access: insert before/after, move up/down, move into/out of container, numerical values. Keyboard shortcuts alone are not the pointer alternative.

Show visible focus. Sticky bars, drawers and banners must not hide the active control. Opening a dialog moves focus into it; closing returns focus to its trigger. Errors need an accessible summary, field-level identification, preserved input and a clear correction path.

Provide reflow without page-wide horizontal scrolling at narrow widths, with carefully bounded exceptions for genuinely two-dimensional content. An editor canvas does not excuse an unusable inspector or toolbar. Respect browser zoom, reduced motion, password managers, paste and autocomplete. Prototype keyboard and touch journeys separately.

# A. Access, workspaces and orientation

## 01 — Staff sign-in [P · page]

**Layout:** Compact sign-in form with product identity, email, password, show-password control, recovery link and one Sign in action. Avoid a large decorative marketing panel. Do not add public SaaS registration or subscription sales without an approved requirement.

**Behavior:** Support password managers, autofill, paste and keyboard submission. Return an authenticated user to the originally requested authorized page. On a phone, the form stays visible above the keyboard.

**States:** Submitting, invalid credentials without account disclosure, temporarily unavailable, and session expired with return-to-work context. Do not clear the email after an error.

## 02 — Password recovery and reset [P · linked page states]

**Layout:** Separate request, request-acknowledgment and new-password states, with one action each. Explain what to do next without claiming delivery that has not been confirmed.

**Behavior:** Allow correction of the email, accessible password visibility, password-manager generation, and return to sign-in. Show requirements before submission rather than after repeated failure.

**States:** Generic acknowledgment, resend pending/cooldown, expired or already-used link, invalid password and successful reset. A failed email notification must not create a fictitious success claim about receipt.

## 03 — Accept a workspace invitation [P · page]

**Layout:** Name the inviting workspace, inviter where safe, proposed role, and what access it grants. Show Accept invitation and the appropriate sign-in/account setup continuation.

**Behavior:** Make the signed-in identity visible. A mismatched account can switch accounts without losing the invitation. Do not imply workspace membership grants all commerce permissions.

**States:** Valid, expired, revoked, already accepted and wrong-account invitation. Provide a request-new-invitation route where supported rather than an unexplained error.

## 04 — Workspace and site switcher [P · popover/full-screen phone overlay]

**Layout:** Searchable workspaces and their sites, recent sites, current selection, and Create site for permitted users. Distinguish identical site names with domain/workspace context.

**Behavior:** Preserve task location when a meaningful equivalent exists. When leaving an edited page, route through the unsaved-change guard. Restore focus on close. Make all choices keyboard reachable.

**States:** One site, many sites, no matches, lost access and switching failure. Do not silently switch a user from a test store into a live store.

## 05 — Sites portfolio [P · page]

**Layout:** Search/filter above list/grid alternatives. Show site name, domain, CMS publication status, commerce status, and last edit. Use a screenshot only if one genuinely exists; otherwise a neutral placeholder.

**Behavior:** Primary action is Create site; each site has a clear Open action and small secondary menu. Site identity and store readiness are different fields, not one green dot.

**States:** First site empty state, filtered empty state, unavailable site and archived site. Do not invent traffic/revenue metrics or imply duplication copies customers, credentials or orders.

## 06 — Create a site [P · short wizard]

**Layout:** Name, default language and Blank selection. Optional ecommerce is an explicit choice, separate from an optional starter template. Put technical/domain settings later.

**Behavior:** Blank creates no hero, header, footer, product grid or demo content. A starter requires explicit selection and names what it inserts. Enabling ecommerce starts connection setup; it does not pretend to provision a paid backend.

**States:** Name validation, creation pending/failure and resume setup. Let the owner create a content-only site and enable commerce later.

## 07 — Site overview [P · page]

**Layout:** Site identity/domain at the top; Edit website and View live site as distinct actions. Below: resumable setup tasks, drafts/recent edits, last release, and relevant issues. Prefer an actionable work queue to a wall of cards.

**Behavior:** Each task opens its exact destination. Explain whether View live is unavailable because nothing is published or a domain is not ready. Commerce tasks disappear on content-only sites.

**States:** New site, established site, unpublished edits, failed publication and disconnected store. Avoid made-up analytics and unnecessary congratulatory banners.

## 08 — Search and command menu [P · overlay]

**Layout:** Search field with scope label, grouped page/template/content results and permitted actions. Show result type, breadcrumb and destination. Display shortcuts only as an additional convenience.

**Behavior:** Search inside the active site by default; explicitly change scope to search across authorized sites. Separate navigation from commands that modify data. An Enter key must not accidentally publish or delete.

**States:** Recent results, searching, no matches, search unavailable and restricted results omitted. Support a button entry point as well as keyboard shortcuts.

# B. Pages and the visual editor

## 09 — Pages list [P · page]

**Layout:** Search, locale and publication filters; rows with page name, path, template, draft/live indicator, author and modification time. Include Add page and contextual duplicate, preview, trash and restore actions.

**Behavior:** Editing a page and configuring its metadata are distinct but easy to reach. Preview defaults to an authorized draft; View live opens published content. Explain removal from the next release versus immediate unpublishing.

**States:** Empty, filtered empty, drafts beside live versions, trash and route conflict. Preserve list state after returning from the editor.

## 10 — Page creation and settings [P · drawer]

**Layout:** Title, path preview, language, template, home-page designation and metadata entry point. Separate descriptive title from route/slug. Existing pages also show duplicate and trash actions in a secondary area.

**Behavior:** Suggest a path but let the author edit it. Flag reserved commerce routes before save. For a published path change, offer a redirect and show the old/new URL.

**States:** Duplicate route, invalid/reserved path, missing translation relationship and unsaved changes. Never silently overwrite a page or reuse another site's template.

## 11 — Empty visual editor [P · page]

**Layout:** Full-height editor with toolbar, left component/layer navigation, empty center canvas and a contextual right inspector. The empty canvas has Add element; Insert starter is separate and optional.

**Behavior:** A beginner can click to add, while an experienced user can drag. The first added element receives focus/selection. The toolbar exposes page, viewport, undo/redo, save status, preview and a single publishing entry point.

**States:** Truly empty page, loading, unavailable component and no editing permission. Guidance is editor chrome and never becomes published page content.

## 12 — Populated editor and selection [P · page]

**Layout:** Canvas is dominant. Use a clear outline for the selected element, a distinct hover outline, a short element breadcrumb and contextual tools. The left and right panels resize/collapse without moving content unpredictably.

**Behavior:** Selecting through the canvas or tree selects the same object. Double-click/explicit edit enters text editing; links do not navigate away while selecting. Offer zoom-to-fit and reset view.

**States:** Nested selection, locked/global/hidden element, long page, incomplete data and component render failure. Show one Publish site action, not two competing buttons.

## 13 — Component library [P · left panel]

**Layout:** Searchable groups for layout, text, media, interaction, commerce, content bindings and installed custom components. Use small previews, readable names and short descriptions, not an oversized tile gallery.

**Behavior:** Click inserts into an explicit selected location; drag shows a precise insertion marker. Offer before/after/inside choices. Components requiring commerce explain the prerequisite instead of silently creating an empty block.

**States:** No results, unsupported nesting, missing dependency and no compatible destination. Future/absent components are excluded from the working library rather than displayed as fake usable items.

## 14 — Layer navigator [P · left panel]

**Layout:** Nested structure with labels, type, lock/hide/global indicators and current selection. Include search and expand/collapse. Keep structure readable with deeply nested elements.

**Behavior:** Rename layers without changing visible content. Provide Move before/after, Move into, Move out, duplicate and delete controls alongside dragging. Protect locked elements and announce reordering.

**States:** Empty tree, invalid move, hidden-at-this-breakpoint, shared instance and deleted selection. A hidden element remains discoverable and recoverable from the tree.

## 15 — Content and data-binding inspector [P · right panel]

**Layout:** Preserve the required inspector organization: Content, Layout, Style, Responsive, Advanced. Content fields support static text, asset selection and structured data bindings where registered.

**Behavior:** A binding picker shows readable record and field names, an example value, fallback and source. Do not ask authors to enter raw database IDs, SQL or JavaScript. Distinguish changing a presentation binding from editing its source record.

**States:** Missing source, incompatible field, deleted record, read-only data and draft-only preview. Explain scope and never expose another site's private content.

## 16 — Layout and style inspector [P · right-panel states]

**Layout:** Layout contains stack/grid direction, alignment, spacing, sizing and positioning. Style contains typography, colors, background, border, radius and shadow. Advanced contains semantic element and supported expert controls.

**Behavior:** Use token selectors with optional explicit local values. Show inherited values, local overrides, units and reset-to-inherited actions. Direct number entry accompanies sliders; linked spacing can be unlinked.

**States:** Invalid value, conflicting layout settings, reset confirmation where broad, and unsupported setting. A local change must not silently mutate a global token.

## 17 — Responsive editing [P · toolbar/inspector states]

**Layout:** Desktop/tablet/phone controls plus current canvas width. The inspector labels inheritance and per-breakpoint overrides. Provide a clear option to remove only the current override.

**Behavior:** Narrower preview width and changing a responsive property are separate actions. Show which widths inherit an edit. On small devices, use one full-width panel at a time instead of microscopic sidebars.

**States:** No overrides, inherited value, explicit override, hidden element and overflow warning. Test actual long text and touch targets rather than approving only neatly fitted placeholder content.

## 18 — ProductGrid configuration [P · inspector/picker]

**Layout:** Source choices such as chosen products, category or collection; searchable real-record picker; item count, sorting, columns, gap, image ratio and displayed details. Show source context and a rendered preview.

**Behavior:** Bind stable references. Clearly label price, visibility and stock as live Medusa values, not editable snapshots. Preview purchase actions are read-only or isolated tests, never live orders.

**States:** Commerce disconnected, no eligible products, deleted source, unpriced variant and backend failure. Design an author-facing diagnostic and a separate restrained shopper-facing fallback.

## 19 — Product and archive template editor [P · editor mode]

**Layout:** Template name/type, sample-product selector, context label and ordinary canvas controls. Offer product title, gallery, price, variants, quantity, availability, purchase controls and related content as registered blocks.

**Behavior:** Switching the sample record changes preview data, not template assignment. Distinguish editing layout from editing product data. Protect security-critical checkout structure from arbitrary removal; checkout styling is not a new payment-flow designer.

**States:** Empty product, many variants, long title, unavailable product and missing binding. Include an ordinary HTML fallback for optional interactive/3D presentation.

## 20 — Reusable sections and global components [P · library/editor mode]

**Layout:** Saved-section library with thumbnail, name, shared/local status and usage count. A shared editing mode displays the affected-page list and a persistent scope banner.

**Behavior:** Distinguish insert a copy, link a shared instance, edit globally and detach this instance. Before publishing a global change, show its impact. Use a local override only where the model supports it.

**States:** Component in use, unavailable source, permission restriction and conflicting version. A global header edit must not look like an isolated page edit.

## 21 — Three.js scene inspector [E · editor mode]

**Layout:** Asset/model selector, camera presets, lighting, transform, playback, interaction, mobile-quality settings and poster/fallback selection. Advanced numeric controls are expandable.

**Behavior:** Preview playback is explicit and pausable. Provide reset camera and numeric alternatives to dragging. Explain performance-sensitive options. Keep headings, links and Add to cart outside the canvas as usable HTML.

**States:** Loading model, unsupported/invalid asset, reduced motion, scene paused, no WebGL and fallback-only mobile. This is scene configuration, not a full 3D-modeling application.

## 22 — Private preview [P · page/overlay]

**Layout:** Near-production rendering with a slim Preview—not live banner, site/page/locale, viewport selection and return-to-editor. Clearly separate current draft, saved draft and live release where those modes exist.

**Behavior:** Show who can access a shared preview and its expiry where supported. Never imply that noindex makes a private draft secure. Shopping controls are non-transactional in preview; a test purchase uses an explicitly separate test context.

**States:** Expired/revoked link, unauthorized viewer, unavailable product data and unsaved local edits excluded from preview. Do not display a misleading live URL.

## 23 — Save, conflict and leave-page recovery [P · interaction-state family]

**Layout:** Persistent save status with concise error detail and Retry. A conflict surface compares the author's version with the newer server version, identifies modification time and offers non-destructive recovery.

**Behavior:** Preserve unsent work. Save-and-leave must wait for acknowledgement; leaving a page cannot itself imply the save succeeded. Provide a review/copy/export recovery option rather than a blind overwrite. Distinguish save failure from publish failure.

**States:** Offline, reconnecting, pending save, permission lost, session expired, conflict and navigation during save. Do not show a saved checkmark while newer unsaved edits remain.

## 24 — Publish review and result [P · drawer/page states]

**Layout:** Site identity and target, summary of all pending pages/templates/navigation/theme changes, validation results, optional release label and Publish site action. Show the whole-site scope explicitly.

**Behavior:** Separate blocking errors from advisories. Publish checks and final result need visible states. No default claim that publishing also changes Medusa records or application deployments. A failure keeps the last live release intact.

**States:** No changes, unsaved drafts, route collision, broken binding, permission restriction, publishing, confirmed live and saved-but-publish-failed. Success links to the actual live destination and release.

## 25 — Releases, comparison and rollback [P · page/detail/confirmation]

**Layout:** Release history with author, time, label, scope, status and active badge. Selecting a release shows changed pages/settings, a preview and Restore this release where allowed.

**Behavior:** Compare previous and current presentation before confirming. State that a CMS rollback does not change products, stock, payments or orders and is separate from code deployment rollback.

**States:** First release, missing referenced commerce content, rollback pending/failure and successful restoration. Do not label a release restored until the active state is confirmed.

# C. Commerce setup and presentation

## 26 — Store overview and launch readiness [P · page]

**Layout:** Store identity, environment, View storefront and Open Medusa Admin. Below show separate checks for backend connectivity, catalog/region configuration, shipping, payment setup and test-purchase verification.

**Behavior:** Every issue has an exact next action and a last-checked time. A connection check does not mark checkout ready. A past successful test is evidence of that test, not a promise of permanent health.

**States:** Commerce off, partially configured, test-ready, live configuration unverified, disconnected and recovered. No invented sales chart; display operational data only when the corresponding source exists.

## 27 — Medusa connection [P · form/detail]

**Layout:** Backend identity/URL, environment, publishable-key setting, masked server credential metadata, test action and last result. Keep a small summary of the owning workspace/site.

**Behavior:** Explain public configuration versus private credentials. Replacing a connection warns about customer carts and context changes. Disabling commerce does not delete Medusa products/orders. Native recovery access remains separate.

**States:** Saved but untested, credentials rejected, unreachable, forbidden origin and incompatible configuration. Never show full stored secrets, pretend saving provisions a backend, or disguise a permission denial as a network problem.

## 28 — Storefront region and catalog context [P · settings panel]

**Layout:** Human-readable available region, country, currency and catalog/sales-channel context. Show configuration explanations and dependent shipping/payment status. Internal IDs belong only in technical details.

**Behavior:** Choose an explicit default rather than silently the first returned region. Region/currency changes explain how existing carts and product prices are affected. Do not equate interface language with currency or destination country.

**States:** Missing region, unavailable country, no prices, stale selection and unsupported combination. Commercial defaults must come from configuration, not the owner's location.

## 29 — Native Medusa Admin handoff [P · contextual transition]

**Layout:** Clearly labeled external-opening control on Store overview and relevant operational placeholders. Identify the store/environment and state that a separate Medusa sign-in may be needed.

**Behavior:** Reuse a concise inline explanation, not a repetitive confirmation dialog. Preserve the CMS work and return path. Use a new tab only with explicit labeling; no embedded iframe or fictitious single sign-on.

**States:** No connection, unknown admin address, unavailable server and access not provisioned. Never show a future custom Order editor when the actual destination is native Medusa Admin.

## 30 — Store presentation assignments [P · page]

**Layout:** Assign default catalog/product/category templates, optional home presentation, cart/checkout presentation and supported conditional overrides. Each row shows scope, current template and preview.

**Behavior:** Separate CMS Content collections from Medusa Product collections. Show matching priority and conflicts before publish. Explicitly enable commerce templates; content-only and blank sites remain untouched.

**States:** No template, conflicting rules, deleted template, reserved-route collision and unpublished assignment. Presentation changes are drafts until published and do not change commercial product records.

# D. Public storefront and the customer journey

## 31 — Storefront shell, navigation and footer [P · shared component family]

**Layout:** Brand, clear navigation, search, cart quantity and account entry only when supported. Footer holds factual contact and relevant store-policy links. Provide desktop navigation and an accessible mobile menu.

**Behavior:** The mobile drawer opens/closes explicitly, restores focus and shows the current location. The cart count reflects actual state. Locale and market controls are distinct where offered.

**States:** Empty/full cart badge, long menu labels, nested categories and unavailable search. No fake reviews, unsupported payment logos, guarantees or invented delivery promises. This shell is optional theme content, not inserted into Blank.

## 32 — Optional reference store homepage [P · template]

**Layout:** One clear proposition, relevant category links, a curated product area and only genuine supporting content. Give product discovery a direct route without forcing users through multiple promotional sections.

**Behavior:** All merchandising sections are editable, reorderable or removable. Present this as an optional example theme. Use explicitly marked sample content in Figma, not fake live operational statistics.

**States:** Small catalog, no featured products, missing imagery and very long translated text. On mobile, keep search/categories reachable without an oversized full-screen hero.

## 33 — Catalog and category listing [P · page template]

**Layout:** Title/breadcrumb, result count, sorting, relevant filters and a consistent product grid. Category pages reuse the structure with optional editorial content. Each card shows image, title, price/currency and relevant variant/availability indication.

**Behavior:** Preserve query, filters, pagination and scroll when returning from a product. Clearly distinguish no catalog, no filter matches and request failure. Use Load more or pagination with a recoverable position.

**States:** One/many/no products, loading more, price unavailable and products with many variants. Do not present a missing price as zero or invent a sale reference price.

## 34 — Product search [P · overlay and results page]

**Layout:** Obvious search input, clear action, result suggestions and a full-results destination. Results include image, name and appropriate price information; categories are visibly distinguished from products.

**Behavior:** Support keyboard selection, dismissal, submitting a query and returning to it. Use real search capabilities only; do not promise intelligent correction or recommendations without implementation.

**States:** No query, loading, no matches, partial failure and long query. Offer clear search/browse categories without silently substituting unrelated products or leaking private catalog content.

## 35 — Mobile filters and sorting [P · sheet]

**Layout:** Dedicated filters sheet with visible selected count, labelled groups, range inputs where relevant, Clear and Show results. Sorting is a short separate menu or a clearly separate section.

**Behavior:** Preserve committed filters. Define whether edits apply immediately or on Show results; do not mix both models. A close/cancel action must handle draft filter changes predictably. Provide number entry alongside a price slider.

**States:** No matches, disabled unavailable options, slow result count and backend error. Keep the apply action reachable above the phone safe area without covering inputs.

## 36 — Product detail, desktop and phone [P · responsive page]

**Layout:** Desktop gallery and buying panel; phone gallery followed by title, price, clearly labelled options, availability, quantity and Add to cart. Details, dimensions and configured delivery/return information follow.

**Behavior:** Use labelled color/size controls, not color alone. The selected image/price/availability update coherently. Do not preselect an arbitrary required size. A phone sticky purchase bar must identify the chosen variant and not hide content.

**States:** Single/multiple images, one/many option dimensions, no valid selection, missing image and long product data. Optional 3D is additive and never the only way to understand or buy the item.

## 37 — Product selection and availability exceptions [P · detail-page variants]

**Layout:** Beside the option controls, show why a combination cannot be bought and the actual action available: choose another option, reduce quantity or retry availability.

**Behavior:** Preserve valid choices when another option changes. Distinguish sold out, invalid combination, unpriced variant, backorder allowed and product unavailable. Never label an upstream failure as out of stock.

**States:** Price changes, last item sold after selection, quantity beyond stock and add-to-cart timeout. Show success only after the cart update is acknowledged; retain choices on failure.

## 38 — Added-to-cart confirmation and mini-cart [P · drawer]

**Layout:** Confirm the exact product/variant/quantity added, current cart items, subtotal with shipping/tax status, View cart and Checkout. Keep Continue shopping visible and easy to reach.

**Behavior:** Preserve the product-page position when closed. Announce the result, manage focus and prevent click-through to the page beneath. Repeated add requests need accurate pending feedback.

**States:** Empty, updating, quantity rejected and cart temporarily unavailable. Do not call unknown shipping free or reset the cart because the backend could not be reached.

## 39 — Full cart [P · page]

**Layout:** Product/variant/image rows, accessible quantity controls, remove, summary, discount entry where supported and Checkout. On a phone use readable stacked rows instead of a compressed desktop table.

**Behavior:** Keep entered quantities visible during updates; totals reflect the confirmed cart. Offer undo/remove recovery only if supported. Expose delivery cost timing before checkout, and label totals provisional where necessary.

**States:** Empty cart, expired cart, stock reduction, price change, discount failure, changed currency/context and temporary outage. An outage is not an empty cart. Explain changes before continuing.

## 40 — Checkout: contact and address [P · page/step]

**Layout:** Minimal store header, progress indicator, Back to cart, guest contact/address form and order summary. Desktop uses two columns; phone stacks the form with an expandable summary that keeps total/context visible.

**Behavior:** Guest checkout is the default. Use supported countries, meaningful labels, autocomplete and optional fields only where needed. Let billing reuse shipping when appropriate. No forced account, marketing opt-in or repeated entry of unchanged information.

**States:** Invalid/unsupported address, session interruption, validation summary and backend delay. Preserve non-sensitive completed fields when navigating or retrying; do not persist raw payment-card details.

## 41 — Checkout: delivery [P · step]

**Layout:** Shipping address summary with Edit, eligible methods with actual cost and supported estimated timing, and Continue to payment. Explain why contact/location changes may recalculate eligibility.

**Behavior:** Select only among returned supported options. When address/cart changes invalidate a selection, request a new choice. Do not invent a free/default method or claim an estimate that configuration does not provide.

**States:** Loading rates, no eligible delivery, carrier outage, method withdrawn and digital/no-shipping order where supported. Provide a correction route without making the customer start over.

## 42 — Checkout: payment and review [P · step]

**Layout:** Review contact/delivery/items, authoritative final total and a provider-controlled payment area. Show only supported methods and an explicit amount/currency on the final purchase action.

**Behavior:** Separate Continue from the button that creates the payment/order. Preserve accessible provider widgets; designers can style the surrounding layout, not invent payment-field behavior. Required operational information and the final total cannot be hidden by a theme setting.

**States:** Provider not ready, total updated, validation failure, test-payment mode and final submission pending. No live keys, raw card data or fake payment-method badges in prototypes.

## 43 — Payment processing, authentication and recovery [P · state family]

**Layout:** Separate submitting, additional provider authentication, cancelled, declined, uncertain/pending and confirmed outcomes. Keep safe order/cart context and a reference where available.

**Behavior:** A slow response does not mean payment failed. Pending confirmation offers status checking and support, not an immediate instruction to pay again. Retry belongs only to an appropriate known state. Preserve safe progress after provider return.

**States:** Double submission, browser reload/back, network loss after payment, provider cancellation, successful payment before delayed order confirmation and known decline. Never infer payment success from the page URL alone.

## 44 — Order confirmation [P · protected page]

**Layout:** Confirmed order reference, actual order/payment state, items, total, address/delivery summary and next step. Provide a protected order-view link and continue-shopping action. Optional account creation comes after the purchase.

**Behavior:** Show only information the customer is authorized to access. Confirmation-email status is separate from order status. A delayed email must not trigger another purchase attempt.

**States:** Order placed but payment pending, payment authorized, confirmed payment, delayed notification and unavailable confirmation details. A celebratory heading must not claim payment received when only an order record exists.

## 45 — Guest order access and tracking [E · request/verification/detail]

**Layout:** Request access, generic request acknowledgment, secure link verification and an authorized order detail. Detail shows factual status, items, shipment events when supplied and support.

**Behavior:** An email/order number alone is not a public lookup permission. Design ownership verification and expired-link recovery. Do not show private order existence or personal data before access is established.

**States:** Wrong/expired/revoked link, pending shipment, no tracking yet, partial shipment and delayed status. Never draw a live map or delivery estimate without a data source.

## 46 — Public information and unavailable-page templates [P · reusable templates]

**Layout:** Content templates for contact/help and actual store-policy information, plus distinct 404, unavailable product, store temporarily unavailable and maintenance screens. Keep these consistent with the active theme.

**Behavior:** Each exception has an appropriate recovery: search/browse, return to cart, retry or contact support. Unknown hosts must not show another tenant's identity. Do not replace outages with a misleading not-found message.

**States:** Form sent/stored versus notification delivery, no help content and support unavailable. Policy copy and commercial promises are supplied/approved by the operator, not invented by the designer.

## 47 — Language and market change [E · menu/confirmation]

**Layout:** Distinct language and country/market selectors with the configured currency explained. Indicate translation availability, not flags alone.

**Behavior:** Preserve the equivalent page where a translation exists. Warn before a market change invalidates items, shipping or prices. Do not imply a language switch automatically converts currency or that untranslated content already exists.

**States:** Missing translation, unsupported market, changed cart and cancelled switch. Avoid automatic geolocation redirects that discard the visitor's explicit choice.

# E. Content, appearance and administration

## 48 — Media library and picker [P · page/modal variants]

**Layout:** Searchable grid/list with folders, file type, upload and selection. The embedded picker reuses the same component and names the intended use: page image, social image, poster or file.

**Behavior:** Show public/private classification, selection count and upload progress. A user can upload without losing their original selection task. Filtering by compatible type prevents selecting unusable assets.

**States:** Empty, no matches, partial batch failure, unsupported format and private upload. Do not mix CMS assets and Medusa product media without identifying their ownership/source.

## 49 — Asset details, upload and usage [P · drawer]

**Layout:** Preview, dimensions/size/type, filename, alt text, caption, visibility and usage references. Include upload/replace status and context-sensitive crop/focal-point controls only where supported.

**Behavior:** Distinguish decorative imagery from meaningful alt text; allow context-specific alt overrides. Before deleting/replacing, list affected pages/templates and explain the result. Replacement is not permission to delete a commerce asset elsewhere.

**States:** Processing, rejected upload, missing asset, in-use deletion and interrupted upload. Support retry per failed file rather than restarting the entire successful batch.

## 50 — Appearance and theme tokens [P · page with preview]

**Layout:** Organized typography, semantic colors, spacing, widths, breakpoints, borders, radii, shadows and motion settings. Preview real representative components beside controls.

**Behavior:** Show token name, value, inherited/local relationship and affected components. Reset and change impact are explicit. Changes remain draft until a CMS release. Do not style the CMS administration when editing a site's theme.

**States:** Contrast warning, missing font, extreme text size, invalid token and import conflict. Preserve local overrides predictably and keep Blank available.

## 51 — Templates and assignment rules [P · list/detail]

**Layout:** Separate pages, article/entry, archive, product, search, 404 and shared header/footer templates by type. Detail shows rules, precedence, effective matches and preview examples.

**Behavior:** Explicitly choose a template for a scope. Explain which rule wins when several match. The editor can see affected pages before publishing and a sample of the effective fallback.

**States:** No match, conflict, deleted template and rules that would include unintended locales/sites. Avoid a magical automatic assignment that cannot be inspected.

## 52 — Navigation builder [P · split page]

**Layout:** Menu selector, nested item tree, item details and desktop/mobile preview. Link targets distinguish internal page, product/category where supported, and external URL.

**Behavior:** Use searchable readable target names and stable references. Add/reorder with buttons as well as dragging. Explain external/new-tab behavior and define maximum supported nesting.

**States:** Empty menu, target trashed/unpublished, circular/invalid nesting and unavailable translation. Warn that removing a menu item does not delete its page.

## 53 — Posts list [E · page]

**Layout:** Search, status/language/category filters and rows with title, author, date, featured image and draft/live state. Include Create post and appropriate bulk actions.

**Behavior:** Reuse Pages list conventions but retain article-specific metadata. Publication date is content metadata; scheduled automatic publishing must not be implied unless implemented. Preserve filters after editing.

**States:** No posts, filtered empty, trash, draft changes on a live article and permission restrictions. Do not introduce a separate incompatible publishing model for posts.

## 54 — Post editor [E · page]

**Layout:** Title and accessible rich text as primary content; excerpt, featured image, author, taxonomy, language, URL and SEO in secondary panels. Link to the assigned article template rather than exposing layout editing everywhere.

**Behavior:** Reuse saving, preview, revisions and publication controls. Distinguish the post body from its presentation template. Show linked translations and missing translation state.

**States:** Unsaved changes, large image, empty title, expired session and concurrent edits. Never generate a translation or schedule status merely to make the wireframe look complete.

## 55 — Collection model/schema builder [E · page]

**Layout:** Collection list and model detail with field name/type, validation, required flag, relationships and preview of the entry form. Explain these are CMS content collections, not product collections.

**Behavior:** Reorder fields accessibly. Before changing/removing a field, show affected entries and potential data loss/migration requirements. Expert options are progressive disclosure.

**States:** First model, duplicate key, invalid relationship, schema mismatch and incompatible proposed change. An unsafe schema edit needs an explicit review step rather than a routine Save.

## 56 — Collection entries and entry editor [E · list/form family]

**Layout:** Model-aware list with configurable visible fields, filters and Create entry; form generated from the field definitions with readable relationship/media pickers and preview.

**Behavior:** Let users understand where an entry appears on the website. Reuse drafts/revisions/trash and translation relationships. A relationship selects a real permitted record, never a raw ID field by default.

**States:** Required field failure, removed schema field, deleted related record, unsaved entry and no assigned public template. Saving an entry does not automatically guarantee a public URL.

## 57 — Forms list and builder [E · page/editor]

**Layout:** Forms list, field canvas, field settings and confirmation/notification settings. Show labels, required rules, validation, submit action and success copy in preview.

**Behavior:** Provide accessible reorder controls. Preview sends no real notifications. Collect only intended information and expose recipient settings to permitted users. Separate successful submission storage from notification delivery.

**States:** No fields, invalid configuration, unavailable notification provider, field errors, abuse rejection and stored-but-email-delayed. Do not promise an email was sent because the submission was saved.

## 58 — Submissions inbox and detail [E · master/detail]

**Layout:** Search/filter, form/date/read-state list and selected submission detail. Provide authorized export and notification-delivery status where supplied.

**Behavior:** Keep private information scoped to the correct site/workspace. Reuse list position, keyboard navigation and explicit bulk selection. Export states include actual field/scope selection rather than a universal data dump.

**States:** No submissions, inaccessible private record, export pending/failure and delayed notification. Deleting a submission is distinct from deleting the form.

## 59 — SEO overview and page metadata [P · page/drawer]

**Layout:** Technical issues grouped by severity, indexing/default metadata controls and links to the exact affected page. Page drawer includes title, description, canonical source and social-preview fields.

**Behavior:** Show inherited defaults and explicit overrides. Preview is illustrative, not a promise of search-engine appearance or rankings. Describe actionable problems rather than an unexplained green SEO score.

**States:** Missing verified domain, missing metadata, broken internal link, invalid canonical and draft/private route. Blocking public exposure and setting noindex are different concepts.

## 60 — Redirect management [E · page/drawer]

**Layout:** Source, destination, type, language/site scope and last validation result. Add/edit uses readable page selection plus a visible URL preview.

**Behavior:** Detect self-redirects, loops, collisions and risky chains before confirmation. Offer redirect creation contextually when changing a published page's path. Preserve the destination's stable reference when possible.

**States:** Invalid target, external target warning, conflict, import failure and referenced missing page. Do not silently rewrite an existing rule or publish an unvalidated import.

## 61 — Integrations directory [E · page]

**Layout:** Only implemented adapters, grouped by purpose, with environment, status and next action. Commerce setup links to its existing configuration rather than creating duplicate settings.

**Behavior:** Distinguish available adapter, configured provider, tested connection and active feature. An arbitrary API key does not create an integration. Missing features can be documented as future designs, not active marketplace entries.

**States:** No adapters, disconnected, degraded, not authorized and unsupported provider. Keep technical detail optional but accessible.

## 62 — Integration details and credentials [E · page/drawer]

**Layout:** Provider purpose, required public settings, masked server-secret metadata, environment, last test, sanitized error and supported enable/disable/replace actions.

**Behavior:** Display which system applies settings. Foundational/runtime secrets are operator-provisioned; do not invent a functioning Save payment key control unless an implemented adapter actually updates the Medusa deployment. Warn about interruption on disable/replace.

**States:** Saved untested, credential rejected, network failure, missing adapter capability and partial setup. No reveal/copy-original-secret option after saving and no secrets in exports.

## 63 — Team members [P · page]

**Layout:** Name/email, workspace/site scope, CMS role, invitation state and commerce capabilities summary. Primary action Invite member. Put sensitive access changes in a clearly labeled detail surface.

**Behavior:** Distinguish membership from capability grants. Do not equate CMS editor with store operator. Show what removing a member affects and preserve ownership continuity.

**States:** Pending/expired invite, no members, last owner, insufficient authority and member already present. Prevent an apparently successful permission change without confirmation from the service.

## 64 — Invitations and role/capability editing [P · drawer/confirmation]

**Layout:** Role description plus specific capability groups: content, publish, site configuration, users, credentials and commerce operations. A summary previews the effective access.

**Behavior:** Use conservative defaults. Explicitly confirm sensitive grants such as customer access, stock adjustments or refunds. Distinguish workspace-wide permissions from one-site scope. A viewer's UI is useful read-only, not a page full of unexplained disabled buttons.

**States:** Conflicting grant, last-owner removal, unauthorized elevation and revoked access during an edit. UI controls supplement rather than replace server authorization.

## 65 — Site settings and languages [E · page]

**Layout:** Identity, default language, available languages, timezone and supported general settings. Commerce currency and countries link to Store settings rather than duplicating or guessing them.

**Behavior:** Translation status names missing/incomplete content. Changing a default language shows route/metadata effects. Site-wide settings are visually separated from the current user's interface preferences.

**States:** Missing translation, unsupported language configuration, unsaved settings and conflicting route prefix. Support Romanian/English/German text expansion and characters without fake translated content.

## 66 — Domains and launch [P · page/detail]

**Layout:** Registered domains, primary domain, verification/connection status, public URL and deploy-environment context. Domain detail offers exact record instructions and copy controls.

**Behavior:** Separate domain entered, DNS verified, routing connected and secure site reachable. Show last check and retry without promising instant propagation. A development-only local backend is not a production commerce connection.

**States:** Pending verification, conflicting ownership, incorrect record, TLS/routing failure and unknown host. Do not make unrelated domains appear verified from a manual checkbox or a successful Save.

## 67 — System health and environment [E · page]

**Layout:** Web/CMS, commerce, storage, notification and configured provider status with last-check time and affected user capability. Technical logs are a controlled drill-down, not the landing view.

**Behavior:** Distinguish development/staging/production from payment test/live mode. Show unknown/not checked separately from healthy. Explain user impact and recovery owner. A CMS publication is not a code deployment.

**States:** Stale status, partial outage, unavailable monitoring and recovered service. Use sanitized errors and no private customer or credential data in screenshots/log examples.

## 68 — Export/import, recovery and danger zone [E · page/wizard]

**Layout:** Export scope, format/version and asset manifest; import review with validation, conflicts and impact; clearly separated destructive site actions. Identify what is not included.

**Behavior:** CMS exports exclude secrets and do not claim to back up/restore Medusa commerce data or the full infrastructure. Preview import changes before apply. Explain trash/archive/delete distinctly and confirm high-impact operations by site name.

**States:** Incompatible schema, missing asset, partial import failure, protected ownership and unsupported restore. Never show a universal Undo that the backend cannot provide.

# F. Later customer accounts and unified commerce operations

These frames are future custom product designs. For initial operations, native Medusa Admin remains the real destination. Do not put unsupported controls into the launch prototype as though they already work. Medusa's own existing pages are not being redesigned by implication.

## 69 — Customer sign-in, registration and recovery [F · page states]

**Layout:** Store-branded customer authentication separate from CMS staff access. Permit sign-in, supported registration and recovery, with continuation to the original cart/order task.

**Behavior:** Account creation is optional after guest purchase. Do not associate an order solely by an unverified matching email. Support password managers and clear verification state.

**States:** Invalid credentials, existing account, pending verification, expired link and session interruption. Never navigate customers to the administration sign-in.

## 70 — Customer account and orders [F · list/detail]

**Layout:** Simple account navigation, order history and per-order items, payment/fulfillment state and available tracking. Use useful empty states rather than a consumer dashboard filled with metrics.

**Behavior:** Open only authorized orders. Reorder and return actions appear only when implemented and valid; current availability/prices must be rechecked. Show factual next steps and support.

**States:** No orders, guest order not yet associated, partial shipment, cancelled order and delayed update. Order creation, payment and fulfillment remain separate statuses.

## 71 — Customer profile and addresses [F · page/forms]

**Layout:** Profile/contact settings and address cards with add/edit/default controls. Use country-appropriate fields and clear account-security entry points where supported.

**Behavior:** Changing account data must not silently rewrite historic order addresses. Preserve form input after validation failure. Confirm removal of a saved address and distinguish it from an active checkout address.

**States:** Invalid address, duplicate default, pending email verification and restricted update. Collect no unrelated marketing/profile fields merely to populate the screen.

## 72 — Unified product list [F · administration page]

**Layout:** Search/filter and columns for product, Medusa publication status, price context, inventory summary, channel availability and CMS presentation. Use Create product only once backed by a real operation.

**Behavior:** Separate published in Medusa from presentable/live in the CMS. Contextual Edit product and Edit presentation are distinct. Bulk actions name their scope and outcome.

**States:** Empty catalog, unavailable backend, partial bulk failure, missing price and missing presentation. Do not imply a CMS release changes product inventory or publication.

## 73 — Unified product editor [F · tabbed page]

**Layout:** Overview/content, media, options/variants, pricing, inventory and organization. Use an editable variant table with SKU, option combination and contextual prices; keep complex tasks out of small dialogs.

**Behavior:** Describe whether saving applies immediately to Medusa. Show warnings for removing variants/changed identifiers and links to stock/pricing detail. Product media source and CMS page media are explicit. Editor preview cannot charge or place orders.

**States:** Duplicate SKU/options, missing prices, invalid variant, partial save failure and removed media. Technical provider capabilities determine available actions; no fake-success save.

## 74 — Product categories and collections [F · list/tree/detail]

**Layout:** Category hierarchy and product-collection lists, with name, handle, associated products and presentation. Label them Product categories/Product collections to avoid CMS model confusion.

**Behavior:** Accessible reordering and reassignment; show effects of deleting a category or changing a handle. Offer presentation and redirect review where supported.

**States:** Empty group, invalid nesting, unavailable product, conflicting handle and cross-site reference. Removing a category must not look like deleting its products.

## 75 — Inventory and stock adjustment [F · list/drawer]

**Layout:** Searchable item/location view with stocked, reserved and available quantities clearly separated. Adjustment drawer shows location, current amount, adjustment type, reason and result.

**Behavior:** Require the appropriate commerce capability and an auditable explicit confirmation. Distinguish changing a physical count from adding/subtracting a quantity. Preserve the distinction between stock and availability to a particular channel.

**States:** Stale count, insufficient permissions, invalid adjustment, failed save and concurrent reservation. Never allow a silent broad adjustment across locations.

## 76 — Orders list [F · page]

**Layout:** Order reference, date, customer summary, total/currency, payment state and fulfillment state. Search, filters and saved list state support routine work. Sensitive fields depend on capability.

**Behavior:** Row opens detail, not a destructive action. Batch tasks clearly list the affected orders and valid operation. Do not collapse all operational states into a single Paid/Unpaid badge.

**States:** Empty, filtered empty, partially paid/refunded, partly fulfilled and backend unavailable. An unavailable backend is not zero orders.

## 77 — Order detail and consequential actions [F · page/dialog family]

**Layout:** Persistent order identity, distinct financial/fulfillment status, items, totals, addresses and factual timeline. Put capture, refund, cancel, fulfillment and return actions in capability- and state-valid locations.

**Behavior:** Each action review shows exact amount/items, reason, notifications and stock implications when supported. Refresh stale data before execution. Confirmed outcome updates the timeline; a timeout may require reconciliation rather than another action.

**States:** Partial refund/fulfillment, action no longer valid, failed notification, concurrent update and uncertain provider outcome. These dialogs must not be generic Are you sure? boxes.

## 78 — Customer directory and detail [F · list/detail]

**Layout:** Searchable permitted customer fields and a profile with authorized orders, contact information and addresses. Keep customer identity separate from workspace staff membership.

**Behavior:** Expose only data needed for the operator's task. Editing customer details must distinguish current profile data from historical order records. Exports and sensitive access require explicit capability.

**States:** No results, restricted fields, guest identity, stale record and update failure. Do not fabricate lifetime-value or marketing-segmentation statistics.

## 79 — Promotions [F · list/rule editor]

**Layout:** Promotion list, status/date context and a rule editor for the supported code/automatic discount, conditions, limits and eligibility. Show a readable rule summary before save.

**Behavior:** Test eligibility against a supported example context without mutating live purchases. Explain stacking/exclusion only as implemented. A storefront invalid-code error identifies a useful correction without exposing internal rule data.

**States:** Expired, not yet active, minimum unmet, excluded items, usage limit and conflicting rules. Do not invent sale timers or claim a discount without actual eligibility.

## 80 — Shipping, regions and operational settings [F · sectioned page]

**Layout:** Regions/countries/currencies, fulfillment locations, supported shipping methods/rates and provider readiness. Separate storefront selection from backend configuration and infrastructure-provisioned secrets.

**Behavior:** Explain availability impact before changing/removing a method or region. Offer an authorized test context where supported. Do not invent tax rates, shipping promises or compliance badges.

**States:** No eligible method, incomplete provider, unsupported region, used-by-active-cart warning and failed save. Native/operator setup remains an explicit handoff where a custom adapter is not implemented.

# Prototype paths and delivery requirements

## Required connected prototypes

**Owner builds and publishes:** sign in → choose/create site → Blank → add page → add content/product grid → responsive edit → image selection → private preview → review all pending site changes → publish → verify live presentation → edit another draft → restore a prior release. Include an autosave failure and a conflicting edit branch.

**Shopper completes a purchase:** search/filter → product → choose required variant → add → cart → guest information → delivery → payment/review → authentication where needed → protected confirmation. Repeat the entire path on a phone. Include invalid address, out-of-stock, declined payment and uncertain payment outcome branches.

**Owner fixes readiness:** Store overview → identify specific blocker → configuration or native Admin handoff → test the relevant capability → observe accurate, dated status. Merely saving a key does not end this path.

**Permissions:** an editor changes content without seeing customer/private commerce data; a viewer can inspect authorized content without misleading edit controls; an authorized commerce operator reviews a consequential action with exact scope.

## Figma structure

Use pages for 00 Brief & flows; 01 Foundations/components; 02 Primary admin; 03 Editor; 04 Storefront desktop; 05 Storefront mobile; 06 Expanded CMS; 07 Future commerce; 08 Prototype tests/handoff. Name frames with their ID, platform and state, for example `40-Checkout-Contact-Mobile-AddressError`.

Build shared components, auto layout, variants and semantic tokens. Use realistic, clearly labeled synthetic content: long titles, multiple variants, large inventories, absent images, decimal/currency variation and translated labels. The final application must not show synthetic metrics or statuses as real. Use developer-reviewed payment widgets as bounded areas; never redesign a provider authentication challenge as a custom CMS form.

Each frame's annotations must cover purpose, user/capability, site/environment, data source, primary and secondary actions, save/live effects, keyboard/focus behavior, narrow-screen behavior, empty/loading/error states, copy and acceptance criteria. Link every primary action and recovery route. Mark a proposed unsupported capability as an engineering dependency, not a finished interaction.

Provide a compact UI component sheet: inputs, selectors, buttons, menus, tables, pagination, empty states, alerts, status badges, drawers/dialogs, upload items, product cards, quantity controls, save status and payment result patterns. Include focus, pressed, pending, read-only, disabled-with-reason and error variants.

## Research and validation plan

Run an initial formative test with approximately 5–7 representative participants, deliberately including a nontechnical owner, a frequent editor, a commerce operator and mobile shoppers; include keyboard and assistive-technology needs. This is a proposed first iteration, not a statistical validation claim or a universal sample-size rule.

Give participants tasks without explaining the interface. Record independent completion, hesitation, wrong destinations, recovery attempts and misunderstanding of draft/live, site context, price changes or payment state. Define task-specific success criteria before the test; do not invent conversion-rate improvements or time targets after seeing results.

A first-time owner should be able to explain what will become live before publishing. A shopper should be able to explain the final amount and whether the order/payment succeeded. A user experiencing failure should know what remains saved and which action is safe next. Rework flows that fail these checks before polishing visual details.

Wireframe approval is not accessibility certification or payment verification. After implementation, run browser, keyboard, responsive, screen-reader and actual test-payment verification with the relevant specialists. Document any editor feature that needs a custom Puck extension and any commerce feature that requires a real Medusa adapter.

## Source and constraint notes

Project basis: supplied original CMS specification, especially administration/ownership (sections 2–3), Blank and visual editing (4–7), content/SEO/publishing (8–10), integrations/media/navigation/domains (11–13); `CLAUDE-CODE-PROMPT.md` Part B (Medusa ownership, operations, components and checkout); `CLAUDE-COURSE-CORRECTION.md`; and `CLAUDE-NEXT-CHECKOUT.md`. Earlier development transcripts are implementation reports, not evidence of current browser or payment validation.

External design baseline checked 21 September 2026: W3C WCAG 2.2 and its Understanding documents for Contrast (Minimum), Target Size (Minimum), Dragging Movements, Focus Not Obscured (Minimum), and Reflow. Medusa's official Admin Development and Admin User Guide establish the native administration surface; custom future frames are project proposals, not claims of supported native restyling.

No SaaS billing/pricing page, marketplace, AI chatbot, team chat, multi-vendor payout flow or public signup funnel is added by this brief. Do not expand into them without a separate approved requirement.

END OF DESIGNER BRIEF
