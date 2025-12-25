const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

// Lightweight .env loader (no external deps)
(() => {
  try {
    const envFile = path.resolve(__dirname, '.env');
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) return;
        const key = m[1];
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      });
    }
  } catch {}
})();

// Export a function so we can read argv.mode to detect production reliably
module.exports = (env = {}, argv = {}) => {
  const isProduction = argv.mode === 'production';
  return {
  entry: './src/index.js',
  output: {
    filename: 'bundle.[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '',
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
      publicPath: ''
    },
    port: 8082,
    historyApiFallback: true,
    host: '0.0.0.0',
    allowedHosts: 'all',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { presets: ['@babel/preset-env', '@babel/preset-react'] },
        },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  resolve: { extensions: ['.js', '.jsx'] },
  plugins: [
    new HtmlWebpackPlugin({ template: 'public/index.html' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/manifest.json', to: 'manifest.json' },
        { from: 'public/favicon.ico', to: 'favicon.ico' }
      ]
    }),
    // Include InjectManifest only in production on Vercel to avoid dev quirks
    ...(isProduction ? [
      new InjectManifest({
        swSrc: './src/service-worker.js',
        swDest: 'service-worker.js',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      })
    ] : []),
    new webpack.DefinePlugin({
      'process.env.CMS_BASE_URL': JSON.stringify(process.env.CMS_BASE_URL || 'http://localhost:4000'),
      'process.env.TV_SUPABASE_URL': JSON.stringify(process.env.TV_SUPABASE_URL || ''),
      'process.env.TV_SUPABASE_ANON': JSON.stringify(process.env.TV_SUPABASE_ANON || ''),
      'process.env.MAPBOX_TOKEN': JSON.stringify(process.env.MAPBOX_TOKEN || '')
    }),
  ],
  };
};


