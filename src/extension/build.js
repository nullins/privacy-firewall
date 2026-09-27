const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const DIST_DIR = 'dist';

// Ensure dist directory exists
function ensureDistDir() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  if (!fs.existsSync(path.join(DIST_DIR, 'ui'))) {
    fs.mkdirSync(path.join(DIST_DIR, 'ui'), { recursive: true });
  }
  if (!fs.existsSync(path.join(DIST_DIR, 'icons'))) {
    fs.mkdirSync(path.join(DIST_DIR, 'icons'), { recursive: true });
  }
  if (!fs.existsSync(path.join(DIST_DIR, 'wasm'))) {
    fs.mkdirSync(path.join(DIST_DIR, 'wasm'), { recursive: true });
  }
}

// Copy WASM files from onnxruntime-web
function copyWasmFiles() {
  const onnxWasmDir = path.join('node_modules', 'onnxruntime-web', 'dist');
  const wasmDistDir = path.join(DIST_DIR, 'wasm');
  
  if (!fs.existsSync(onnxWasmDir)) {
    console.warn('⚠ ONNX Runtime WASM directory not found, trying alternative path...');
    // Try alternative path from @huggingface/transformers
    const altDir = path.join('node_modules', '@huggingface', 'transformers', 'dist');
    if (fs.existsSync(altDir)) {
      const files = fs.readdirSync(altDir).filter(f => f.endsWith('.wasm') || f.includes('ort-wasm'));
      files.forEach(file => {
        fs.copyFileSync(path.join(altDir, file), path.join(wasmDistDir, file));
      });
      if (files.length > 0) {
        console.log(`✓ Copied ${files.length} WASM files from transformers dist`);
        return;
      }
    }
    console.warn('⚠ Could not find WASM files to copy');
    return;
  }
  
  const wasmFiles = fs.readdirSync(onnxWasmDir).filter(f => 
    f.endsWith('.wasm') || f.includes('ort-wasm')
  );
  
  wasmFiles.forEach(file => {
    fs.copyFileSync(path.join(onnxWasmDir, file), path.join(wasmDistDir, file));
  });
  
  console.log(`✓ Copied ${wasmFiles.length} WASM files`);
}

// Copy static files
function copyStaticFiles() {
  // Copy manifest.json
  fs.copyFileSync('manifest.json', path.join(DIST_DIR, 'manifest.json'));
  console.log('✓ Copied manifest.json');

  // Copy popup HTML and CSS
  fs.copyFileSync('ui/popup.html', path.join(DIST_DIR, 'ui/popup.html'));
  fs.copyFileSync('ui/popup.css', path.join(DIST_DIR, 'ui/popup.css'));
  console.log('✓ Copied popup.html and popup.css');

  // Copy settings HTML and CSS (if exists)
  if (fs.existsSync('ui/settings.html')) {
    fs.copyFileSync('ui/settings.html', path.join(DIST_DIR, 'ui/settings.html'));
    console.log('✓ Copied settings.html');
  }
  if (fs.existsSync('ui/settings.css')) {
    fs.copyFileSync('ui/settings.css', path.join(DIST_DIR, 'ui/settings.css'));
    console.log('✓ Copied settings.css');
  }
  fs.copyFileSync(
    path.join('node_modules', '@picocss', 'pico', 'css', 'pico.min.css'),
    path.join(DIST_DIR, 'ui', 'pico.min.css')
  );
  console.log('✓ Copied Pico CSS');

  // Copy icons
  const iconsDir = 'icons';
  if (fs.existsSync(iconsDir)) {
    fs.readdirSync(iconsDir).forEach(file => {
      fs.copyFileSync(path.join(iconsDir, file), path.join(DIST_DIR, 'icons', file));
    });
    console.log('✓ Copied icons');
  }
  
  // Copy WASM files
  copyWasmFiles();
}

async function build() {
  try {
    ensureDistDir();

    // Build background script as a classic Firefox background script
    await esbuild.build({
      entryPoints: ['background.js'],
      bundle: true,
      outfile: path.join(DIST_DIR, 'background.js'),
      format: 'iife',
      platform: 'browser',
      target: 'firefox128',
      minify: false,
      sourcemap: true,
    });
    console.log('✓ Built background.js');

    // Build content script (IIFE for content scripts)
    await esbuild.build({
      entryPoints: ['content-script.js'],
      bundle: true,
      outfile: path.join(DIST_DIR, 'content-script.js'),
      format: 'iife',
      platform: 'browser',
      target: 'firefox128',
      minify: false,
      sourcemap: true,
    });
    console.log('✓ Built content-script.js');

    // Build popup script
    await esbuild.build({
      entryPoints: ['ui/popup.js'],
      bundle: true,
      outfile: path.join(DIST_DIR, 'ui/popup.js'),
      format: 'iife',
      platform: 'browser',
      target: 'firefox128',
      minify: false,
      sourcemap: true,
    });
    console.log('✓ Built popup.js');

    // Build settings script (if exists)
    if (fs.existsSync('ui/settings.js')) {
      await esbuild.build({
        entryPoints: ['ui/settings.js'],
        bundle: true,
        outfile: path.join(DIST_DIR, 'ui/settings.js'),
        format: 'iife',
        platform: 'browser',
        target: 'firefox128',
        minify: false,
        sourcemap: true,
      });
      console.log('✓ Built settings.js');
    }

    // Copy static files
    copyStaticFiles();

    console.log('\n🎉 Build complete! Load the extension from the "dist" folder.');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
