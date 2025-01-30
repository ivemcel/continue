# Codebase Indexing

This is a small Rust library for efficiently keeping a codebase index up to date.

### How it works

> Important definition: a _tag_ is a (workspace, branch, provider_id) pair that uniquely identifies an index. Since we use content-based addressing within the index, much of the data is shared for efficiency.

The output of the sync_results function is a list of 4 lists of tuples. Each tuple contains a file path and a hash of the file contents. The 4 lists are:

1. Compute: Files that need to be newly computed or updated
2. Delete: Files that need to be deleted from the index
3. Add label: Files that exist in the index but need to have a label added for a new tag
4. Remove label: Files that exist in the index but need to have a label removed

The labels help us filter when retrieving results from an index like Meilisearch or Chroma. All ids of the items in these indices are the hash of the file contents (possibly plus a chunk index at the end).

The first time, a Merkle tree of the codebase folder is constructed, ignoring any files in .gitignore or .continueignore. Every file found will be returned as needing to be computed added to the index.

Thereafter, the following steps are performed:

1. Load the previously computed merkle tree for the tag
2. Compute the current merkle tree of the codebase
3. Update the .last_sync file with current timestamp
4. Save the new tree to disk
5. Compute the diff of the trees, which tells you which files have been a) added or b) removed
6. For each file added:
   - If in the global cache, append it to `add_label`
   - Otherwise, append it to `compute`
7. For each file removed:
   - If in the global cache, but only in rev_tags for this tag, append it to `delete`
   - If in global cache for more than this tag, append it to `remove_label`
   - Otherwise, ignore. This should never happen.
8. Return (compute, delete, add_label, remove_label)

### Files created

Several files are stored and updated on disk in the ~/.continue/index folder to keep track of indexed files:

- `~/.continue/index/tags/<dir>/<branch>/<provider_id>/merkle_tree` - the last computed Merkle tree of the codebase for a given tag
- `~/.continue/index/tags/<dir>/<branch>/<provider_id>/.last_sync` - the last time the tag was synced
- The index cache contains a list of hashes that have already been computed both in general and per tag. These are always kept in sync.
  - `~/.continue/index/.index_cache` - contains the global cache (flat file of hashes)
  - `~/.continue/index/tags/<dir>/<branch>/<provider_id>/.index_cache` - contains the tag-specific cache (flat file of hashes)
  - `~/.continue/index/rev_tags` - contains a mapping from hash to tags that the hash is currently indexed for. This is a directory of files, where each file is prefixed with the first 2 characters of the hash. The file is a JSON mapping from hash to list of tags.

### Files

- `lib.rs` contains just the top-level function that is called by the Python bindings
- `sync/merkle.rs` contains the Merkle tree implementation (for building and comparing trees)
- `sync/mod.rs` contains the main sync logic, which handles maintenance of the on-disk database of which hashes are included in which tags

### Current limitations:

- Only handles local files, so is not currently being used in situations where the Continue server is on a different machine from the IDE or the workspace (Remote SSH, WSL, or a Continue server being run for a team).
- Currently not using stat to check for recent changes to files, is instaed re-calculating the entire Merkle tree on every IDE reload. This is fine for now since it only takes 0.2 seconds on the Continue codebase, but is a quick improvement we can make later.

代码库索引
=====

这是一个小型的 Rust 库，用于高效地保持代码库索引的更新。

### 工作原理

> 重要定义：一个 _标签_ 是由 (工作区，分支，provider\_id) 组成的唯一标识索引的组合。由于我们在索引中使用基于内容的寻址，许多数据会共享以提高效率。

`sync_results` 函数的输出是四个元组列表。每个元组包含一个文件路径和该文件内容的哈希值。这四个列表分别是：

1.  **计算**：需要重新计算或更新的文件
2.  **删除**：需要从索引中删除的文件
3.  **添加标签**：已经存在于索引中的文件，但需要为新标签添加标签
4.  **移除标签**：已经存在于索引中的文件，但需要移除标签

这些标签帮助我们在从像 Meilisearch 或 Chroma 这样的索引中检索结果时进行筛选。所有索引中项的 ID 都是文件内容的哈希（可能加上末尾的块索引）。

第一次时，会为代码库文件夹构建一个 Merkle 树，忽略 `.gitignore` 或 `.continueignore` 中列出的文件。找到的每个文件都将被返回，标记为需要重新计算并添加到索引中。

之后，执行以下步骤：

1.  加载之前为该标签计算的 Merkle 树
2.  计算代码库当前的 Merkle 树
3.  用当前时间戳更新 `.last_sync` 文件
4.  将新树保存到磁盘
5.  计算两棵树的差异，这告诉你哪些文件被 a) 添加或 b) 删除
6.  对于每个添加的文件：
    *   如果在全局缓存中，将其附加到 `add_label`
    *   否则，将其附加到 `compute`
7.  对于每个删除的文件：
    *   如果在全局缓存中，但仅在此标签的 `rev_tags` 中，附加到 `delete`
    *   如果在全局缓存中并且属于多个标签，附加到 `remove_label`
    *   否则，忽略。这种情况应该永远不会发生。
8.  返回 `(compute, delete, add_label, remove_label)`

### 创建的文件

为了跟踪索引的文件，会在 `~/.continue/index` 文件夹中存储并更新多个文件：

*   `~/.continue/index/tags/<dir>/<branch>/<provider_id>/merkle_tree` - 为给定标签计算的最后一棵 Merkle 树
*   `~/.continue/index/tags/<dir>/<branch>/<provider_id>/.last_sync` - 上次同步该标签的时间
*   索引缓存包含已经计算过的哈希值列表，这些哈希值既是全局的，也针对每个标签进行存储。这些缓存始终保持同步。
    *   `~/.continue/index/.index_cache` - 包含全局缓存（哈希值的平面文件）
    *   `~/.continue/index/tags/<dir>/<branch>/<provider_id>/.index_cache` - 包含标签特定缓存（哈希值的平面文件）
    *   `~/.continue/index/rev_tags` - 包含从哈希到当前被索引标签的映射。这是一个文件夹，每个文件以哈希的前两个字符作为前缀。文件是哈希到标签列表的 JSON 映射。

### 文件结构

*   `lib.rs` 仅包含由 Python 绑定调用的顶层函数
*   `sync/merkle.rs` 包含 Merkle 树的实现（用于构建和比较树）
*   `sync/mod.rs` 包含主要的同步逻辑，负责维护磁盘上的数据库，记录哪些哈希值包含在哪些标签中

### 当前限制：

*   目前仅处理本地文件，因此在 Continue 服务器与 IDE 或工作区不在同一台机器上的情况下，尚未使用（如远程 SSH、WSL 或为团队运行的 Continue 服务器）。
*   当前未使用 `stat` 来检查文件的最新更改，而是每次 IDE 重载时都会重新计算整个 Merkle 树。虽然对于 Continue 代码库来说，这样做的速度足够快（大约 0.2 秒），但我们以后可以做一个快速的优化来改进这部分。
