console.log(Object.keys(process.env).filter(k => k.includes('FIREBASE') || k.includes('GOOGLE') || k.includes('SERVICE')));
