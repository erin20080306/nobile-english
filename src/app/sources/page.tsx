import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sources & Credits - Mobile English',
  description: 'Dictionary data sources and attributions',
};

const dictionarySources = [
  {
    name: 'Wiktionary (via Wiktextract)',
    languages: ['English', 'Korean', 'Italian', 'Spanish'],
    license: 'CC BY-SA 4.0',
    attribution: 'Wiktionary contributors',
    url: 'https://en.wiktionary.org/',
    description: 'Free multilingual dictionary with definitions, pronunciations, and examples.',
  },
  {
    name: 'WordNet',
    languages: ['English'],
    license: 'MIT',
    attribution: 'Princeton University',
    url: 'https://wordnet.princeton.edu/',
    description: 'Lexical database for English with semantic relationships between words.',
  },
  {
    name: 'CMU Pronouncing Dictionary',
    languages: ['English'],
    license: 'BSD-3-Clause',
    attribution: 'Carnegie Mellon University',
    url: 'https://github.com/cmusphinx/cmudict',
    description: 'Machine-readable pronunciation dictionary for North American English.',
  },
  {
    name: 'JMdict',
    languages: ['Japanese'],
    license: 'CC BY-SA 3.0',
    attribution: 'EDRDG (Electronic Dictionary Research and Development Group)',
    url: 'https://www.edrdg.org/jmdict/j_jmdict.html',
    description: 'Japanese-English dictionary with kanji, readings, and translations.',
  },
  {
    name: 'KANJIDIC2',
    languages: ['Japanese'],
    license: 'CC BY-SA 3.0',
    attribution: 'EDRDG (Electronic Dictionary Research and Development Group)',
    url: 'https://www.edrdg.org/kanjidic/kanjidic.html',
    description: 'Japanese kanji dictionary with readings, meanings, and stroke counts.',
  },
];

const aiServices = [
  {
    name: 'Google Gemini',
    license: 'Google Terms of Service',
    attribution: 'Google LLC',
    url: 'https://ai.google.dev/',
    description: 'AI-powered language enrichment for learning-focused content.',
  },
];

export default function SourcesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          Sources & Credits
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            Dictionary Data Sources
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Our dictionary data is sourced from the following open-source projects and databases.
            We comply with all licensing requirements and provide proper attribution.
          </p>

          <div className="space-y-6">
            {dictionarySources.map((source, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {source.name}
                  </h3>
                  <span className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
                    {source.languages.join(', ')}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {source.description}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">License:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">{source.license}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">Attribution:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">{source.attribution}</span>
                  </div>
                </div>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Visit Source →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            AI Services
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We use AI services to enhance learning content with contextual examples and explanations.
            AI is only used to supplement existing dictionary data, never as the primary source.
          </p>

          <div className="space-y-6">
            {aiServices.map((service, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                  {service.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {service.description}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">License:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">{service.license}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">Attribution:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">{service.attribution}</span>
                  </div>
                </div>
                {service.url && (
                  <a
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Learn More →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            Data Version & Updates
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Dictionary data is periodically updated from the original sources. Each entry in our database
            includes the following metadata:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
            <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">source_name</code> - Original data source</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">source_license</code> - License information</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">source_attribution</code> - Attribution requirements</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">source_version</code> - Source version identifier</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">imported_at</code> - Import timestamp</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">is_ai_enriched</code> - AI enrichment flag</li>
          </ul>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
