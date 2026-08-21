/**
 * Archetypes, not industries.
 *
 * A photographer and an architect are different trades and the same website:
 * the work is the argument, the gallery is the hero, the conversion is an
 * enquiry. A dentist and a plumber are one shape too: local trust, a service
 * list, a booking. Sorting by the *shape of site* lets sixteen entries cover
 * nearly everybody, and choosing one answers the next twenty questions —
 * pages, features, the goal, the atmosphere, the scene — so the rest of the
 * wizard is disagreeing with good defaults rather than supplying them.
 *
 * Each carries sectors, because "restaurant" and "fine dining" want different
 * copy even when they want the same structure, and the sector is a word the
 * brief can use.
 */

import type { Archetype } from '@superbuilds/protocol';

const s = (id: string, label: string, blurb?: string) => ({ id, label, blurb });

export const ARCHETYPES: Archetype[] = [
  {
    id: 'portfolio', label: 'Portfolio or studio', icon: 'frame',
    blurb: 'Photographer, designer, architect, film-maker, 3D artist',
    audience: 'People deciding whether your work is right for their project',
    sectors: [s('photographer', 'Photographer'), s('designer', 'Designer'), s('architect', 'Architect'), s('filmmaker', 'Film-maker'), s('illustrator', 'Illustrator'), s('3d-artist', '3D artist'), s('motion', 'Motion designer')],
    defaults: { goal: 'enquiries', pages: ['home', 'work', 'about', 'contact'], features: ['gallery', 'contact-form', 'testimonials'], palette: 'ink', typography: 'editorial', atmosphere: 'quiet-gallery', layout: 'immersive-scene', scene: 'relief' },
  },
  {
    id: 'agency', label: 'Agency or consultancy', icon: 'spark',
    blurb: 'Creative, digital, branding, marketing, strategy',
    audience: 'A client choosing who to trust with their brand and their budget',
    sectors: [s('creative', 'Creative agency'), s('digital', 'Digital product studio'), s('branding', 'Branding'), s('marketing', 'Marketing'), s('consulting', 'Consulting'), s('architecture-firm', 'Architecture practice')],
    defaults: { goal: 'enquiries', pages: ['home', 'work', 'services', 'about', 'insights', 'contact'], features: ['contact-form', 'testimonials', 'blog'], palette: 'obsidian', typography: 'brutal', atmosphere: 'bold-editorial', layout: 'immersive-scene', scene: 'morph' },
  },
  {
    id: 'saas', label: 'Software or app', icon: 'cube',
    blurb: 'B2B SaaS, developer tool, AI product, mobile app, marketplace',
    audience: 'Someone evaluating whether this solves their problem and what it costs',
    sectors: [s('b2b', 'B2B SaaS'), s('devtool', 'Developer tool'), s('ai', 'AI product'), s('mobile', 'Mobile app'), s('fintech', 'Fintech'), s('marketplace', 'Marketplace')],
    defaults: { goal: 'signups', pages: ['home', 'features', 'pricing', 'docs', 'changelog', 'contact'], features: ['pricing-table', 'newsletter', 'faq', 'changelog', 'contact-form'], palette: 'ultraviolet', typography: 'grotesk', atmosphere: 'technical', layout: 'split-stage', scene: 'exploded' },
  },
  {
    id: 'hardware', label: 'Product, hardware or vehicle', icon: 'gear',
    blurb: 'A physical thing: a bike, a helmet, a speaker, a drone, a machine',
    audience: 'Someone who wants to see the thing from every angle before they believe in it',
    sectors: [s('vehicle', 'Vehicle or bike'), s('audio', 'Audio'), s('wearable', 'Wearable'), s('robotics', 'Robotics or drone'), s('furniture', 'Furniture'), s('industrial', 'Industrial equipment')],
    defaults: { goal: 'sales', pages: ['home', 'product', 'features', 'shop', 'contact'], features: ['payments', 'faq', 'newsletter'], palette: 'mono', typography: 'geometric', atmosphere: 'futurist', layout: 'long-scroll-story', scene: 'exploded' },
  },
  {
    id: 'local-service', label: 'Local service', icon: 'house',
    blurb: 'Plumber, electrician, cleaner, landscaper, builder',
    audience: 'Someone nearby with a problem, deciding who to phone first',
    sectors: [s('plumber', 'Plumber'), s('electrician', 'Electrician'), s('cleaner', 'Cleaning'), s('landscaper', 'Landscaping'), s('builder', 'Builder or contractor'), s('mover', 'Removals'), s('mechanic', 'Mechanic')],
    defaults: { goal: 'calls', pages: ['home', 'services', 'areas', 'about', 'contact'], features: ['contact-form', 'reviews', 'map', 'faq'], palette: 'trade', typography: 'grotesk', atmosphere: 'plain-confident', layout: 'minimal-column', scene: 'terrain' },
  },
  {
    id: 'clinic', label: 'Clinic or practice', icon: 'plus',
    blurb: 'Dentist, physio, therapist, vet, optician',
    audience: 'A patient choosing somewhere to trust with their health',
    sectors: [s('dentist', 'Dentist'), s('physio', 'Physiotherapy'), s('therapist', 'Therapy or counselling'), s('vet', 'Veterinary'), s('derma', 'Dermatology or aesthetics'), s('optician', 'Optician')],
    defaults: { goal: 'bookings', pages: ['home', 'services', 'team', 'about', 'contact'], features: ['booking', 'faq', 'reviews', 'map'], palette: 'clean', typography: 'humanist', atmosphere: 'calm', layout: 'minimal-column', scene: 'relief' },
  },
  {
    id: 'restaurant', label: 'Restaurant, café or bar', icon: 'bowl',
    blurb: 'Restaurant, café, bakery, bar, food truck',
    audience: 'Somebody hungry, on a phone, deciding where to go tonight',
    sectors: [s('restaurant', 'Restaurant'), s('cafe', 'Café'), s('bakery', 'Bakery'), s('bar', 'Bar'), s('food-truck', 'Food truck'), s('fine-dining', 'Fine dining')],
    defaults: { goal: 'bookings', pages: ['home', 'menu', 'about', 'contact'], features: ['booking', 'gallery', 'map', 'hours'], palette: 'ember', typography: 'display-serif', atmosphere: 'appetite', layout: 'stacked-cards', scene: 'diorama' },
  },
  {
    id: 'shop', label: 'Shop or brand', icon: 'bag',
    blurb: 'Fashion, jewellery, furniture, cosmetics, anything you sell',
    audience: 'A shopper who wants to see it, trust it, and buy it without friction',
    sectors: [s('fashion', 'Fashion'), s('jewellery', 'Jewellery'), s('home', 'Homeware'), s('beauty', 'Beauty'), s('sports', 'Sports'), s('food', 'Food and drink')],
    defaults: { goal: 'sales', pages: ['home', 'shop', 'product', 'about', 'contact'], features: ['payments', 'gallery', 'reviews', 'newsletter'], palette: 'paper', typography: 'editorial', atmosphere: 'retail', layout: 'editorial-grid', scene: 'cloth' },
  },
  {
    id: 'fitness', label: 'Fitness and wellness', icon: 'bolt',
    blurb: 'Gym, yoga studio, personal trainer, climbing, spa',
    audience: 'Somebody deciding whether this is the place they will actually keep going to',
    sectors: [s('gym', 'Gym'), s('yoga', 'Yoga or pilates'), s('trainer', 'Personal trainer'), s('climbing', 'Climbing'), s('martial-arts', 'Martial arts'), s('spa', 'Spa or wellness')],
    defaults: { goal: 'signups', pages: ['home', 'classes', 'pricing', 'team', 'contact'], features: ['booking', 'pricing-table', 'testimonials', 'map'], palette: 'acid', typography: 'condensed', atmosphere: 'kinetic', layout: 'horizontal-journey', scene: 'ribbons' },
  },
  {
    id: 'property', label: 'Property, architecture or stays', icon: 'key',
    blurb: 'Estate agent, developer, interiors, coworking, hotel',
    audience: 'Someone imagining themselves in the space',
    sectors: [s('estate-agent', 'Estate agent'), s('developer', 'Property developer'), s('interiors', 'Interior design'), s('coworking', 'Coworking'), s('hotel', 'Hotel or stays'), s('architecture', 'Architecture')],
    defaults: { goal: 'enquiries', pages: ['home', 'listings', 'spaces', 'about', 'contact'], features: ['gallery', 'contact-form', 'map', 'search'], palette: 'sand', typography: 'display-serif', atmosphere: 'establishment', layout: 'split-stage', scene: 'terrain' },
  },
  {
    id: 'education', label: 'Education', icon: 'book',
    blurb: 'School, academy, course, tutor, bootcamp',
    audience: 'A learner or a parent deciding whether this is worth the time and money',
    sectors: [s('school', 'School'), s('course', 'Online course'), s('tutor', 'Tutor'), s('bootcamp', 'Bootcamp'), s('university', 'University department'), s('workshop', 'Workshops')],
    defaults: { goal: 'signups', pages: ['home', 'courses', 'admissions', 'team', 'contact'], features: ['faq', 'testimonials', 'contact-form', 'newsletter'], palette: 'slate', typography: 'humanist', atmosphere: 'warm-direct', layout: 'bento', scene: 'morph' },
  },
  {
    id: 'events', label: 'Events and entertainment', icon: 'ticket',
    blurb: 'Festival, conference, venue, wedding planner, theatre',
    audience: 'Somebody deciding whether to be there, and buying the ticket now',
    sectors: [s('festival', 'Festival'), s('conference', 'Conference'), s('venue', 'Venue'), s('wedding', 'Wedding planner'), s('theatre', 'Theatre or company'), s('club', 'Club night')],
    defaults: { goal: 'sales', pages: ['home', 'programme', 'pricing', 'about', 'contact'], features: ['payments', 'faq', 'newsletter', 'map'], palette: 'dusk', typography: 'brutal', atmosphere: 'kinetic', layout: 'long-scroll-story', scene: 'wordmark' },
  },
  {
    id: 'professional', label: 'Professional services', icon: 'scale',
    blurb: 'Law firm, accountant, adviser, recruiter',
    audience: 'A client choosing somebody careful with something that matters',
    sectors: [s('law', 'Law firm'), s('accounting', 'Accountant'), s('finance', 'Financial adviser'), s('recruiter', 'Recruitment'), s('insurance', 'Insurance broker'), s('notary', 'Notary')],
    defaults: { goal: 'consultations', pages: ['home', 'services', 'team', 'insights', 'contact'], features: ['booking', 'faq', 'blog', 'contact-form'], palette: 'midnight-gold', typography: 'serif-body', atmosphere: 'establishment', layout: 'minimal-column', scene: 'glass' },
  },
  {
    id: 'nonprofit', label: 'Non-profit or cause', icon: 'heart',
    blurb: 'Charity, foundation, campaign, community project',
    audience: 'Someone who cares, deciding whether to give or to join',
    sectors: [s('charity', 'Charity'), s('foundation', 'Foundation'), s('campaign', 'Campaign'), s('community', 'Community project'), s('environment', 'Environmental'), s('arts', 'Arts organisation')],
    defaults: { goal: 'donations', pages: ['home', 'cause', 'impact', 'about', 'contact'], features: ['payments', 'newsletter', 'testimonials', 'blog'], palette: 'forest', typography: 'humanist', atmosphere: 'warm-direct', layout: 'long-scroll-story', scene: 'field' },
  },
  {
    id: 'creator', label: 'Creator, artist or personal brand', icon: 'star',
    blurb: 'Musician, author, speaker, chef, athlete, maker',
    audience: 'A fan, a reader, or somebody who wants to book you',
    sectors: [s('musician', 'Musician'), s('author', 'Author'), s('speaker', 'Speaker'), s('chef', 'Chef'), s('athlete', 'Athlete'), s('maker', 'Maker or artist')],
    defaults: { goal: 'subscribers', pages: ['home', 'work', 'about', 'writing', 'contact'], features: ['newsletter', 'gallery', 'contact-form'], palette: 'rose', typography: 'display-serif', atmosphere: 'cinematic', layout: 'immersive-scene', scene: 'wordmark' },
  },
  {
    id: 'other', label: 'Something else', icon: 'dots',
    blurb: 'Pick the closest shape. Everything can be renamed later.',
    audience: 'The people you want to reach',
    sectors: [s('business', 'A business'), s('project', 'A project'), s('person', 'A person'), s('place', 'A place'), s('idea', 'An idea')],
    defaults: { goal: 'enquiries', pages: ['home', 'about', 'contact'], features: ['contact-form'], palette: 'ink', typography: 'grotesk', atmosphere: 'plain-confident', layout: 'immersive-scene', scene: 'field' },
  },
];

export function archetypeFor(id: string): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[ARCHETYPES.length - 1];
}
