'use server';

/**
 * @fileOverview A geocoding AI agent that converts an address into latitude and longitude coordinates.
 *
 * - geocodeAddress - A function that handles the geocoding process.
 * - GeocodeAddressInput - The input type for the geocodeAddress function.
 * - GeocodeAddressOutput - The return type for the geocodeAddress function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeocodeAddressInputSchema = z.object({
  address: z.string().describe('The address to geocode.'),
});
export type GeocodeAddressInput = z.infer<typeof GeocodeAddressInputSchema>;

const GeocodeAddressOutputSchema = z.object({
  latitude: z.number().describe('The latitude of the address.'),
  longitude: z.number().describe('The longitude of the address.'),
});
export type GeocodeAddressOutput = z.infer<typeof GeocodeAddressOutputSchema>;

export async function geocodeAddress(input: GeocodeAddressInput): Promise<GeocodeAddressOutput> {
  return geocodeAddressFlow(input);
}

const prompt = ai.definePrompt({
  name: 'geocodeAddressPrompt',
  input: {schema: GeocodeAddressInputSchema},
  output: {schema: GeocodeAddressOutputSchema},
  prompt: `You are a geocoding expert. Given an address, you will return the latitude and longitude coordinates.

Address: {{{address}}}

Please provide the latitude and longitude in the following JSON format:
{
  "latitude": <latitude>,
  "longitude": <longitude>
}`,
});

const geocodeAddressFlow = ai.defineFlow(
  {
    name: 'geocodeAddressFlow',
    inputSchema: GeocodeAddressInputSchema,
    outputSchema: GeocodeAddressOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
