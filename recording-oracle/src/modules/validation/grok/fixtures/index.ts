import { GrokResponsesApiResponse } from '../grok.interface';

export const generateGrokResponse = (
  text: string,
): GrokResponsesApiResponse => ({
  output: [
    {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text,
        },
      ],
    },
  ],
});
