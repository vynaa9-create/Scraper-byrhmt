import MoleBuild from "molebuild";

const ml = new MoleBuild();

try {
    const data = await ml.counter("Chou");

    console.log(JSON.stringify(data, null, 2));

} catch (err) {
    console.error(err);
}